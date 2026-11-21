"""Deterministic sign-restricted Bayes factors for the existing paired score model.

The two hypotheses truncate the same proper symmetric encompassing prior.
BF+/− = posterior odds / prior odds; this is not a point-null comparison.
"""
from pathlib import Path
import csv
import hashlib
import json
import platform
import numpy as np
import scipy
from scipy.special import ndtr, logsumexp
from scipy.optimize import brentq

ROOT = Path(__file__).resolve().parents[2]


def mixture(y, effect_sd=.5, residual_sd=.5, eta=2, points=90, rho_points=151):
    y = np.asarray(y, dtype=float)
    if y.shape != (3, 2) or not np.isfinite(y).all():
        raise ValueError('Expected three finite paired block observations')
    if min(effect_sd, residual_sd, eta) <= 0:
        raise ValueError('Proper positive prior scales required')
    n = len(y)
    mean = y.mean(axis=0)
    scatter = (y-mean).T @ (y-mean)
    sd = np.exp(np.linspace(np.log(.0001), np.log(max(8*residual_sd, 6*np.std(y,axis=0,ddof=1).max())), points))
    rho = np.linspace(-.9995, .9995, rho_points)
    s1,s3,r = np.meshgrid(sd,sd,rho,indexing='ij')
    s1,s3,r = (x.ravel() for x in (s1,s3,r))
    om = 1-r*r
    i11,i22,i12 = 1/(s1*s1*om),1/(s3*s3*om),-r/(s1*s3*om)
    a,b,c = s1*s1/n+effect_sd**2,s3*s3/n+effect_sd**2,r*s1*s3/n
    det = a*b-c*c
    logw = -(n-1)/2*np.log(s1*s1*s3*s3*om)-.5*np.log(det)
    logw -= .5*(i11*scatter[0,0]+2*i12*scatter[0,1]+i22*scatter[1,1])
    logw -= .5*(b*mean[0]**2-2*c*mean[0]*mean[1]+a*mean[1]**2)/det
    logw += -.5*(s1/residual_sd)**2-.5*(s3/residual_sd)**2+(eta-1)*np.log(om)+np.log(s1)+np.log(s3)
    # Constant normalizing factors cancel within this proper-prior posterior.
    for v in (s1,s3,r):
        logw[np.isin(v,[v.min(),v.max()])] -= np.log(2)
    w=np.exp(logw-logsumexp(logw))
    edge=np.isin(s1,[sd[0],sd[-1]]) | np.isin(s3,[sd[0],sd[-1]]) | np.isin(r,[rho[0],rho[-1]])
    edge_mass=float(w[edge].sum())
    q1,q3,q12=n*i11+1/effect_sd**2,n*i22+1/effect_sd**2,n*i12
    dq=q1*q3-q12*q12
    v1,v3,v12=q3/dq,q1/dq,-q12/dq
    b1,b3=n*(i11*mean[0]+i12*mean[1]),n*(i12*mean[0]+i22*mean[1])
    m1,m3=v1*b1+v12*b3,v12*b1+v3*b3
    # Discard only numerically negligible mass, renormalizing explicitly.
    keep=w>1e-16
    return w[keep]/w[keep].sum(),[(m1[keep],v1[keep]),(m3[keep],v3[keep])],edge_mass


def summarize(w,m,v):
    sd=np.sqrt(v)
    positive=float(w @ ndtr(m/sd))
    negative=float(w @ ndtr(-m/sd))
    bounds=(float(np.min(m-12*sd)),float(np.max(m+12*sd)))
    def quantile(p):
        return brentq(lambda x: float(w @ ndtr((x-m)/sd))-p,*bounds,xtol=1e-9)
    return dict(mean=float(w@m),median=quantile(.5),lower95=quantile(.025),upper95=quantile(.975),probability_positive=positive,
                probability_nonpositive=negative,prior_probability_positive=.5,
                bf_positive_nonpositive=positive/negative,log10_bf=float(np.log10(positive)-np.log10(negative)))


def main():
    plan_path=ROOT/'config/bayesian_directional_v1.json'
    plan=json.loads(plan_path.read_text())
    source=ROOT/plan['input']
    with source.open() as f: scores=list(csv.DictReader(f))
    y=np.array([[float(r[k]) for k in ('day1_vs_control','day3_vs_control')] for r in scores])
    settings=[(e,s,2) for e in [.25,.5,1] for s in [.25,.5,1]]+[(.5,.5,1),(.5,.5,4)]
    rows=[];density=[]
    for e,s,eta in settings:
        print(f'Integrating effect={e} residual={s} eta={eta}',flush=True)
        base=mixture(y,e,s,eta,90,151)
        refined=mixture(y,e,s,eta,130,221)
        for day,((m,v),(mf,vf)) in enumerate(zip(base[1],refined[1]),1):
            day = 1 if day == 1 else 3
            a=summarize(base[0],m,v);b=summarize(refined[0],mf,vf)
            delta=abs(a['log10_bf']-b['log10_bf'])
            rows.append(dict(day=f'Day {day}',effect_sd=e,residual_sd=s,eta=eta,**b,
                             coarse_log10_bf=a['log10_bf'],log10_bf_grid_difference=delta,
                             edge_mass=refined[2],numerically_resolved=delta<.02 and refined[2]<.001))
            if (e,s,eta)==(.5,.5,2):
                for x in np.linspace(-1,1.25,226):
                    post=float(refined[0] @ (np.exp(-.5*((x-mf)/np.sqrt(vf))**2)/np.sqrt(2*np.pi*vf)))
                    density.append(dict(day=f'Day {day}',score=float(x),posterior_density=post,prior_density=float(np.exp(-.5*(x/e)**2)/(e*np.sqrt(2*np.pi)))))
        del base,refined
    archived=list(csv.DictReader((ROOT/'tables/bayesian_oxphos/posterior_summary.csv').open()))
    archived_sign=[]
    for r in archived:
        if r['parameter'] not in ('mu_day1_vs_control','mu_day3_vs_control'):continue
        p=float(r['probability_gt_zero'])
        archived_sign.append(dict(fit=r['fit'],likelihood=r['likelihood'],day='Day 1' if 'day1' in r['parameter'] else 'Day 3',effect_sd=float(r['effect_sd']),residual_sd=float(r['residual_sd']),probability_positive=p,bf_positive_nonpositive=p/(1-p),log10_bf=float(np.log10(p/(1-p))),source='transformed archived NUTS sign probability; subject to Monte Carlo uncertainty'))
    for r in rows:
        match=next((a for a in archived_sign if a['likelihood']=='normal' and a['day']==r['day'] and a['effect_sd']==r['effect_sd'] and a['residual_sd']==r['residual_sd']),None)
        r['archived_probability_positive']=match['probability_positive'] if match and r['eta']==2 else None
        r['probability_difference_from_archive']=r['probability_positive']-match['probability_positive'] if match and r['eta']==2 else None
    out=ROOT/'tables/bayesian_directional'
    for name,data in [('normal_sensitivity',rows),('archived_directional',archived_sign),('baseline_densities',density)]:
        with (out/f'{name}.csv').open('w') as f:
            writer=csv.DictWriter(f,fieldnames=list(data[0]));writer.writeheader();writer.writerows(data)
    provenance=dict(classification=plan['classification'],hypotheses=plan['hypotheses'],prior_odds=1,input_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),plan_sha256=hashlib.sha256(plan_path.read_bytes()).hexdigest(),analysis_code_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),archived_posterior_sha256=hashlib.sha256((ROOT/'tables/bayesian_oxphos/posterior_summary.csv').read_bytes()).hexdigest(),python=platform.python_version(),numpy=np.__version__,scipy=scipy.__version__,all_numerically_resolved=all(r['numerically_resolved'] for r in rows),maximum_log10_bf_grid_difference=max(r['log10_bf_grid_difference'] for r in rows),maximum_edge_mass=max(r['edge_mass'] for r in rows),not_point_null=True)
    (out/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    fixture=dict(provenance=provenance,scores=scores,settings=rows,archived=archived_sign,density=density)
    (ROOT/'explorer/src/data/bayesian-directional.json').write_text(json.dumps(fixture,separators=(',',':'))+'\n')
    if not provenance['all_numerically_resolved']:raise RuntimeError('Numerical tolerance failed; report before interpreting')
    print(json.dumps(provenance,indent=2))

if __name__=='__main__':main()
