"""Post hoc, hash-frozen OXPHOS uncertainty sensitivity. No primary refitting.

Run Rscript src/transcriptomics/export_bayesian_oxphos.R first, then invoke
with .venv-bayes/bin/python -m src.transcriptomics.bayesian_oxphos.
"""
from pathlib import Path
import hashlib
import json
import os
for _v in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS'):
    os.environ[_v] = '1'
import numpy as np
import pandas as pd
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tables/bayesian_oxphos'
DRAWS = ROOT / 'provenance/bayesian_oxphos_draws'


def verify_freeze(root=ROOT):
    freeze = json.loads((root/'provenance/bayesian_oxphos_freeze_v1.json').read_text())
    for p, expected in {**freeze['files'], **freeze['input_sha256']}.items():
        if hashlib.sha256((root/p).read_bytes()).hexdigest() != expected:
            raise ValueError(f'Frozen file changed: {p}')


def paired_scores(profiles, blocks, conditions):
    if profiles.duplicated(['block','condition']).any():
        raise ValueError('Duplicate block-condition profiles')
    required = {(b,c) for b in blocks for c in ['control',*conditions]}
    if set(zip(profiles.block, profiles.condition)) != required:
        raise ValueError('Incomplete or unexpected block-condition profiles')
    p = profiles.pivot(index='block',columns='condition',values='score').loc[blocks]
    result = p[conditions].to_numpy() - p[['control']].to_numpy()
    if not np.isfinite(result).all():
        raise ValueError('Nonfinite scores')
    return result


def validate_gene_differences(y, membership, blocks, conditions):
    old = pd.read_csv(ROOT/'tables/transcriptomics/per_block_gene_directions.csv')
    old = old[old.symbol.isin(membership.symbol)]
    if old.duplicated(['block','contrast','symbol']).any():
        raise ValueError('Duplicate gene differences')
    for b, block in enumerate(blocks):
        for j, condition in enumerate(conditions):
            contrast = condition.replace('psilocin_', '') + '_vs_control'
            sub = old[(old.block==block)&(old.contrast==contrast)]
            if set(sub.symbol) != set(membership.symbol):
                raise ValueError('Full mapped OXPHOS membership not preserved')
            np.testing.assert_allclose(y[b,j],sub.log2_normalized_ratio.mean(),rtol=0,atol=1e-12)
        sub = old[(old.block==block)&(old.contrast=='day3_vs_day1')]
        np.testing.assert_allclose(y[b,1]-y[b,0],sub.log2_normalized_ratio.mean(),rtol=0,atol=1e-12)


def diagnostics(idata):
    import arviz as az
    names=['mu','sd','rho','treated_day_difference']
    s=az.summary(idata,var_names=names,kind='diagnostics',round_to=None)
    # Calculate unrounded diagnostics explicitly; az.summary rounding otherwise masks thresholds.
    rh=az.rhat(idata,var_names=names).to_array().values
    bulk=az.ess(idata,var_names=names,method='bulk').to_array().values
    tail=az.ess(idata,var_names=names,method='tail').to_array().values
    d=dict(rhat_max=float(np.nanmax(rh)),ess_bulk_min=float(np.nanmin(bulk)),ess_tail_min=float(np.nanmin(tail)),divergences=int(idata.sample_stats.diverging.sum()))
    d['passed']=bool(d['rhat_max']<=1.01 and d['ess_bulk_min']>=1000 and d['ess_tail_min']>=1000 and d['divergences']==0 and np.isfinite(rh).all())
    return d,s


def save_group(group,path):
    np.savez_compressed(path,**{k:group[k].values for k in group.data_vars})


def fit(y, cfg, effect_sd, residual_sd, likelihood):
    import pymc as pm
    import arviz as az
    key=f'{likelihood}_effect{effect_sd:g}_residual{residual_sd:g}'
    dest=DRAWS/key
    dest.mkdir(parents=True,exist_ok=True)
    fingerprint=hashlib.sha256((ROOT/'config/bayesian_oxphos_v1.json').read_bytes()+y.tobytes()+(ROOT/'src/transcriptomics/bayesian_oxphos.py').read_bytes()).hexdigest()
    cached=dest/'result.json'
    if cached.exists():
        result=json.loads(cached.read_text())
        if result['fingerprint'] != fingerprint:
            raise ValueError('Cached fit fingerprint differs; preserve existing run and resolve explicitly')
        print('Reusing completed fit',key,flush=True)
        return result
    coords={'contrast':['day1_vs_control','day3_vs_control'],'block':cfg['blocks']}
    with pm.Model(coords=coords) as model:
        mu=pm.Normal('mu',0,effect_sd,dims='contrast')
        chol,corr,std=pm.LKJCholeskyCov('chol',n=2,eta=2,sd_dist=pm.HalfNormal.dist(residual_sd),compute_corr=True)
        pm.Deterministic('sd',std,dims='contrast')
        pm.Deterministic('rho',corr[0,1])
        pm.Deterministic('treated_day_difference',mu[1]-mu[0])
        if likelihood=='normal':
            pm.MvNormal('observed',mu=mu,chol=chol,observed=y,dims=('block','contrast'))
        else:
            pm.MvStudentT('observed',nu=4,mu=mu,chol=chol,observed=y,dims=('block','contrast'))
        prior=pm.sample_prior_predictive(samples=cfg['predictive_draws'],random_seed=cfg['mcmc']['seed'])
        save_group(prior.prior,dest/'prior.npz')
        save_group(prior.prior_predictive,dest/'prior_predictive.npz')
        attempts=[]
        for attempt in range(2):
            pars=dict(cfg['mcmc'])
            pars['random_seed']=pars.pop('seed')
            if attempt:
                pars.update(tune=4000,draws=8000,target_accept=.99)
            idata=pm.sample(**pars,progressbar=False,return_inferencedata=True)
            d,sd=diagnostics(idata)
            d['attempt']=attempt+1
            attempts.append(d)
            save_group(idata.posterior,dest/f'posterior_attempt{attempt+1}.npz')
            save_group(idata.sample_stats,dest/f'sample_stats_attempt{attempt+1}.npz')
            sd.to_csv(dest/f'diagnostics_attempt{attempt+1}.csv')
            print(key,d,flush=True)
            if d['passed']:
                break
        pp=pm.sample_posterior_predictive(idata,random_seed=cfg['mcmc']['seed'],progressbar=False)
        save_group(pp.posterior_predictive,dest/'posterior_predictive.npz')
    rows=[]
    for param in ['mu','treated_day_difference','sd','rho']:
        values=idata.posterior[param].values
        pri=prior.prior[param].values
        components=range(2) if param in ('mu','sd') else [None]
        for j in components:
            v=(values[...,j] if j is not None else values).ravel()
            p=(pri[...,j] if j is not None else pri).ravel()
            lo,hi=np.quantile(v,[.025,.975]);pl,ph=np.quantile(p,[.025,.975])
            label=f'{param}_{coords["contrast"][j]}' if j is not None else param
            rows.append(dict(fit=key,likelihood=likelihood,effect_sd=effect_sd,residual_sd=residual_sd,parameter=label,mean=float(v.mean()),median=float(np.median(v)),lower95=float(lo),upper95=float(hi),probability_gt_zero=float((v>0).mean()),prior_lower95=float(pl),prior_upper95=float(ph),posterior_prior_width_ratio=float((hi-lo)/(ph-pl)),computationally_valid=attempts[-1]['passed']))
    predictive=[]
    for source,group in [('prior',prior.prior_predictive),('posterior',pp.posterior_predictive)]:
        v=group.observed.values.reshape(-1,3,2)
        for j,c in enumerate(coords['contrast']):
            for stat,sim,observed in [('block_value',v[:,:,j].ravel(),None),('three_block_mean',v[:,:,j].mean(axis=1),y[:,j].mean()),('three_block_sd',v[:,:,j].std(axis=1,ddof=1),y[:,j].std(ddof=1))]:
                lo,med,hi=np.quantile(sim,[.025,.5,.975])
                predictive.append(dict(fit=key,source=source,contrast=c,statistic=stat,lower95=float(lo),median=float(med),upper95=float(hi),observed=None if observed is None else float(observed)))
            for b,block in enumerate(cfg['blocks']):
                predictive.append(dict(fit=key,source=source,contrast=c,statistic='observed_block_predictive_percentile',block=block,observed=float(y[b,j]),percentile=float((v[:,b,j]<=y[b,j]).mean())))
    result=dict(fit=key,fingerprint=fingerprint,attempts=attempts,posterior=rows,predictive=predictive)
    cached.write_text(json.dumps(result,indent=2)+'\n')
    return result


def main():
    verify_freeze()
    cfg=json.loads((ROOT/'config/bayesian_oxphos_v1.json').read_text())
    profiles=pd.read_csv(OUT/'profile_scores.csv')
    membership=pd.read_csv(OUT/'membership.csv')
    if len(membership)!=182 or membership.symbol.duplicated().any() or membership.gene_id.duplicated().any():
        raise ValueError('Expected 182 unique mapped genes')
    y=paired_scores(profiles,cfg['blocks'],cfg['conditions'])
    validate_gene_differences(y,membership,cfg['blocks'],cfg['conditions'])
    scores=pd.DataFrame(y,columns=['day1_vs_control','day3_vs_control'])
    scores.insert(0,'block',cfg['blocks'])
    scores['treated_day3_minus_day1']=y[:,1]-y[:,0]
    scores.to_csv(OUT/'paired_scores.csv',index=False)
    print(scores.to_string(index=False),flush=True)
    results=[]
    for e in cfg['prior_effect_sd']:
        for s in cfg['prior_residual_sd']:
            results.append(fit(y,cfg,e,s,'normal'))
    results.append(fit(y,cfg,.5,.5,'student_t4'))
    pd.DataFrame([r for x in results for r in x['posterior']]).to_csv(OUT/'posterior_summary.csv',index=False)
    pd.DataFrame([dict(fit=x['fit'],**d) for x in results for d in x['attempts']]).to_csv(OUT/'diagnostics.csv',index=False)
    pd.DataFrame([r for x in results for r in x['predictive']]).to_csv(OUT/'predictive_checks.csv',index=False)
    import pymc,arviz,sys
    manifest=dict(python=sys.version,pymc=pymc.__version__,arviz=arviz.__version__,all_fits_valid=all(x['attempts'][-1]['passed'] for x in results),files={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(DRAWS.rglob('*')) if p.is_file()})
    (ROOT/'provenance/bayesian_oxphos_run.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('All declared fits completed; all valid:',manifest['all_fits_valid'],flush=True)

if __name__=='__main__':
    main()
