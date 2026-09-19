"""Regenerate reporting tables from frozen outputs, without refitting/selecting tests."""
from pathlib import Path
import hashlib, json, itertools
import numpy as np
import pandas as pd

ROOT=Path(__file__).resolve().parents[2]
T=ROOT/'tables/transcriptomics'
def md(frame):
    def f(v):
        if isinstance(v,(float,np.floating)): return 'NA' if np.isnan(v) else f'{v:.5g}'
        return str(v).replace('|','/').replace('\n',' ')
    return '| '+' | '.join(map(str,frame.columns))+' |\n|'+'|'.join(['---']*len(frame.columns))+'|\n'+'\n'.join('| '+' | '.join(f(v) for v in row)+' |' for row in frame.itertuples(index=False,name=None))+'\n'
def verify():
    f=json.loads((ROOT/'provenance/analysis_freeze.json').read_text())
    for p,h in f['sha256'].items():
        assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h,p
    for p,info in json.loads((ROOT/'provenance/isolated_rebuild.json').read_text())['comparisons'].items():
        assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==info['original'],p

def classify(q,nes,block,technical):
    aligned=lambda a: len(a)>0 and np.isfinite(a).all() and (np.sign(a)==np.sign(nes)).all() and nes!=0
    if q<.05:
        if any(np.isfinite(v) and np.sign(v)!=np.sign(nes) for v in block):return 'block-dependent'
        return 'robust' if aligned(block) and aligned(technical) else 'directionally consistent but uncertain'
    return 'directionally consistent but uncertain' if aligned(block) and aligned(technical) else 'unsupported'

def main():
    verify()
    allx=pd.read_csv(T/'enrichment_all.csv'); main=pd.read_csv(T/'enrichment_primary_model.csv'); primary=main[main.tier=='primary'].copy()
    assert len(primary)==15 and not allx.duplicated(['variant','pathway','contrast']).any()
    blocks=sorted(v for v in allx.variant.unique() if v.startswith('block_'))
    omit=sorted(v for v in allx.variant.unique() if v.startswith('omit_'))
    tech=['RIN_covariate','RIN_ge6','one_library_per_group']; variants=blocks+omit+tech
    detail=[]
    for r in primary.itertuples():
        s=allx[(allx.pathway==r.pathway)&(allx.contrast==r.contrast)].set_index('variant')
        assert set(s.index)=={'primary',*variants}
        computed=classify(r.family_fdr,r.NES,s.loc[blocks+omit,'NES'].values,s.loc[tech,'NES'].values)
        assert computed==r.robustness,(r.pathway,r.contrast)
        fail=[v for v in variants if not np.isfinite(s.loc[v,'NES']) or np.sign(s.loc[v,'NES'])!=np.sign(r.NES)]
        d=r._asdict(); d.update(direction='positive' if r.NES>0 else 'negative',failed_direction_checks=';'.join(fail),primary_fdr_pass=r.family_fdr<.05)
        for v in variants:
            for col in ['NES','pval','family_fdr','leadingEdge']: d[f'{v}__{col}']=s.loc[v,col]
        detail.append(d)
    detail=pd.DataFrame(detail);detail.to_csv(T/'primary_pathway_evidence.csv',index=False)
    allx[allx.tier=='primary'].to_csv(T/'primary_pathway_evidence_long.csv',index=False)
    gs=json.loads((ROOT/'config/gene_sets.yaml').read_text()); sets={s['id']:set(s['genes']) for s in gs['sets']}
    selected=pd.read_csv(T/'gene_mapping.csv');selected=selected[selected.selected].set_index('symbol')
    be=pd.read_csv(T/'per_block_gene_directions.csv')
    assert not be.duplicated(['block','contrast','symbol']).any()
    contrasts=['day1_vs_control','day3_vs_control','day3_vs_day1']
    genes=pd.DataFrame({'symbol':sorted(set.union(*(sets[p] for p in primary.pathway.unique())))})
    genes['gene_id']=genes.symbol.map(selected.gene_id)
    genes['pathway_membership']=genes.symbol.map(lambda g:';'.join(p for p in primary.pathway.unique() if g in sets[p]))
    for co in contrasts:
        for v in ['primary','RIN_ge6']:
            f=pd.read_csv(T/f'{v}_{co}_genes.csv').set_index('gene_id')
            for col in ['log2FoldChange','lfcSE','stat','pvalue','padj']:
                genes[f'{v}__{co}__{col}']=genes.gene_id.map(f[col])
        for b in sorted(be.block.unique()):
            f=be[(be.block==b)&(be.contrast==co)].set_index('symbol')
            genes[f'{b}__{co}__log2_normalized_ratio']=genes.symbol.map(f.log2_normalized_ratio)
        edges={r.pathway:set(str(r.leadingEdge).split(';')) for r in primary[primary.contrast==co].itertuples()}
        genes[f'{co}__leading_edge_membership']=genes.symbol.map(lambda g:';'.join(p for p,e in edges.items() if g in e))
    genes.to_csv(T/'primary_pathway_gene_detail.csv',index=False)
    breadth=[]; overlap=[]
    for r in primary.itertuples():
        edge=set(r.leadingEdge.split(';')); rank=pd.read_csv(T/f'primary_{r.contrast}_ranks.csv').set_index('symbol').statistic
        weights=rank.reindex(sorted(edge)).abs().sort_values(ascending=False)
        b=be[(be.contrast==r.contrast)&be.symbol.isin(edge)].groupby('block').log2_normalized_ratio.agg(['mean',lambda x:np.mean(np.sign(x)==np.sign(r.NES))])
        br={'pathway':r.pathway,'contrast':r.contrast,'robustness':r.robustness,'mapped_size':r.size,'leading_edge_n':len(edge),'top5_abs_rank_weight_fraction':weights.head(5).sum()/weights.sum(),'max_gene_abs_rank_weight_fraction':weights.max()/weights.sum()}
        for block,row in b.iterrows():br[block+'__edge_mean_log_ratio']=row.iloc[0];br[block+'__edge_same_direction_fraction']=row.iloc[1]
        br['max_abs_block_mean_fraction']=b['mean'].abs().max()/b['mean'].abs().sum()
        breadth.append(br)
    breadth=pd.DataFrame(breadth);breadth.to_csv(T/'leading_edge_breadth.csv',index=False)
    for p in primary.pathway.unique():
        a=set(primary[(primary.pathway==p)&(primary.contrast==contrasts[0])].iloc[0].leadingEdge.split(';'));b=set(primary[(primary.pathway==p)&(primary.contrast==contrasts[1])].iloc[0].leadingEdge.split(';'))
        overlap.append({'pathway':p,'day1_edge_n':len(a),'day3_edge_n':len(b),'shared_n':len(a&b),'jaccard':len(a&b)/len(a|b),'shared_genes':';'.join(sorted(a&b)),'day1_only':';'.join(sorted(a-b)),'day3_only':';'.join(sorted(b-a))})
    overlap=pd.DataFrame(overlap);overlap.to_csv(T/'leading_edge_time_overlap.csv',index=False)
    pairs=[]
    for co in contrasts:
        bypath=primary[primary.contrast==co].set_index('pathway')
        for pa,pb in itertools.combinations(primary.pathway.unique(),2):
            ea=set(bypath.loc[pa,'leadingEdge'].split(';'));eb=set(bypath.loc[pb,'leadingEdge'].split(';'))
            pairs.append({'contrast':co,'pathway_a':pa,'pathway_b':pb,'shared_n':len(ea&eb),'jaccard':len(ea&eb)/len(ea|eb),'shared_genes':';'.join(sorted(ea&eb))})
    pd.DataFrame(pairs).to_csv(T/'primary_leading_edge_overlap.csv',index=False)
    gmt=ROOT/'data/raw/gene_sets/c2.cp.reactome.v2026.1.Hs.symbols.gmt';rx={p[0]:set(p[2:]) for p in (l.split('\t') for l in gmt.read_text().splitlines())}
    plasticity=['REACTOME_SIGNALING_BY_NTRK2_TRKB','REACTOME_NCAM_SIGNALING_FOR_NEURITE_OUT_GROWTH','REACTOME_PROTEIN_PROTEIN_INTERACTIONS_AT_SYNAPSES','REACTOME_NEUROTRANSMITTER_RELEASE_CYCLE','REACTOME_GLUTAMATE_NEUROTRANSMITTER_RELEASE_CYCLE','HALLMARK_PI3K_AKT_MTOR_SIGNALING']
    refs={p:rx.get(p,sets.get(p)) for p in plasticity}
    rows=[]
    for r in primary.itertuples():
        e=set(r.leadingEdge.split(';'))
        for p,members in refs.items():
            hit=e&members
            rows.append({'primary_pathway':r.pathway,'contrast':r.contrast,'context_pathway':p,'primary_membership_shared_n':len(sets[r.pathway]&members),'edge_n':len(e),'context_members_n':len(members),'edge_shared_n':len(hit),'edge_shared_fraction':len(hit)/len(e),'jaccard':len(hit)/len(e|members),'shared_genes':';'.join(sorted(hit))})
    pd.DataFrame(rows).to_csv(T/'metabolic_plasticity_overlap.csv',index=False)
    (ROOT/'config/plasticity_overlap_context.json').write_text(json.dumps({'status':'post-results descriptive annotation, no enrichment tests','source_sha256':hashlib.sha256(gmt.read_bytes()).hexdigest(),'sets':{p:sorted(v) for p,v in refs.items()}},indent=2)+'\n')
    view=detail[['pathway','contrast','NES','pval','family_fdr','direction','robustness','failed_direction_checks']].copy()
    report='''# Schmidt primary results\n\nNewly analyzed frozen v1.0 results; reporting finalized 2026-09-18. The 07:56 UTC local freeze and all recorded input hashes verify unchanged. The existing isolated rebuild reproduced the count matrix and four core result/mapping tables byte-for-byte; this is computational reproduction, not independent biological replication.\n\nTwenty-three libraries were conservatively pooled into nine condition profiles across three differentiation blocks and two cell lines. DESeq2 used `~ block + condition`, rank 5, residual df 4. Primary pathway tests use finite signed Wald ranks and BH across all 15 tests. NES is a competitive enrichment statistic, not a pathway fold change or flux measurement. Gene effects and unshrunken Wald SEs are exported separately.\n\n## Exact frozen rule\n\n'''
    cfg=json.loads((ROOT/'config/analysis.yaml').read_text())
    report+='\n'.join(f'- **{k}:** {v}' for k,v in cfg['robustness'].items())+'\n\nAll three per-block, all three omission and all three technical/RIN directions must agree for “robust.” Smaller sensitivities need not independently attain significance. These labels describe within-dataset directional stability only. A direction reversal in one block overrides an impressive primary FDR.\n\n## All primary tests\n\n'+md(view)
    report+='\nA. Day 1 versus the available control: all five anchors pass the rule. B. Day 3 versus the available control: OXPHOS, ROS and PI3K–AKT–mTOR pass; glycolysis is block-dependent and mTORC1 unsupported. C. Treatment-specific temporal evolution: unidentifiable because control harvest days remain unresolved. None of the treated Day-3-minus-Day-1 anchors passes the robustness rule. Neither differences in NES nor significance at only one day establish a return to baseline.\n\n'
    for r in detail.to_dict('records'):
        report+=f"### {r['pathway']} — {r['contrast']}\n\nPrimary NES {r['NES']:.6g}; nominal p {r['pval']:.6g}; 15-test BH {r['family_fdr']:.6g}; {r['robustness']}. FDR gate {'passes' if r['primary_fdr_pass'] else 'fails'}; failed directional checks: {r['failed_direction_checks'] or 'none'}.\n\n"
        s=allx[(allx.pathway==r['pathway'])&(allx.contrast==r['contrast'])]
        report+=md(s[['variant','NES','pval','family_fdr']])+f"\nFull primary leading edge: {r['leadingEdge']}.\n\n"
    report+='''## Leading-edge interpretation and deliverables\n\n`tables/transcriptomics/primary_pathway_gene_detail.csv` includes all primary members, fixed selected gene IDs, both control contrasts and treated-time contrast, log2FC/SE/Wald statistic/gene BH, low-RIN-exclusion effects, each block's descriptive direction and leading-edge memberships. Gene-level BH differs from pathway-family BH. Missing genes remain explicit. `primary_pathway_evidence.csv` and its long-form companion include every sensitivity estimate, p/FDR and leading edge.\n\n'''+md(breadth[['pathway','contrast','leading_edge_n','top5_abs_rank_weight_fraction','max_gene_abs_rank_weight_fraction','max_abs_block_mean_fraction']])
    report+='\nThe weight fractions quantify concentration of absolute Wald hit weights **within** the leading edge; they are not fractions of ES variance, causal contribution or proof against all influence. The maximum block fraction refers to absolute descriptive mean log ratios; block omission is the direct fitted influence check.\n\n'+md(overlap.drop(columns=['shared_genes','day1_only','day3_only']))
    report+='\nComposition differences are descriptive: leading-edge membership depends on the ranked universe and threshold at the enrichment peak. No formal gene-composition temporal test was frozen. Shared genes and day-only members are fully exported, with no claim that day-only membership proves differential temporal expression.\n\nThe OXPHOS leading edges contain multiple respiratory-chain gene families (NDUF, COX, UQCR and SDH) as well as mitochondrial import, translation and intermediary-metabolic genes. This supports broad mitochondrial-associated transcription, not increased ATP synthesis. ROS leading edges include peroxidase, thioredoxin/peroxiredoxin and other stress/signaling components; the Hallmark name does not establish either raised ROS or a specific NRF2–GSH mechanism. Glycolysis includes glycosylation, signaling and other genes; mTOR-associated transcription does not establish kinase activation.\n\n`metabolic_plasticity_overlap.csv` quantifies exact overlaps with six bounded plasticity/signaling sets, including zero overlaps. This post-results annotation is descriptive and does not establish functional independence when overlap is small, or causal mediation when genes are shared. Gene-set membership and leading edges are correlated evidence. Three blocks give a minimum two-sided exhaustive sign-flip p of 0.25; competitive enrichment FDR must not be mistaken for biological-sample significance.\n'
    coverage=[]
    for name in primary.pathway.unique():
        missing=sets[name]-set(selected.index)
        coverage.append({'pathway':name,'original_members':len(sets[name]),'selected_symbol_matches':len(sets[name])-len(missing),'unmatched_symbols':';'.join(sorted(missing))})
    pd.DataFrame(coverage).to_csv(T/'primary_mapping_coverage.csv',index=False)
    report+='\n## Literal-symbol coverage limitation\n\n'+md(pd.DataFrame(coverage))
    report+='\nOXPHOS has 182/200 literal symbol matches. Fifteen unmatched ATP5-prefixed membership symbols coexist with differently named ATP5 symbols in the source counts. The frozen no-alias-rescue rule is preserved. In particular, the absence of these ATP-synthase symbols from leading edges cannot be interpreted as absence of their transcripts or a specific lack of complex-V response. No post-results remapping test was added. `primary_leading_edge_overlap.csv` quantifies all pairwise primary leading-edge overlaps within each contrast.\n'
    (ROOT/'reports/schmidt_primary_results.md').write_text(report)
    sec=main[main.tier=='secondary'].copy();sec['test_status']=np.where(sec.NES.isna(),'untestable under frozen minSize=15','tested')
    sec.to_csv(T/'secondary_evidence.csv',index=False)
    (ROOT/'reports/schmidt_secondary_results.md').write_text('# Frozen secondary results\n\nThese seven sets were already executed by the frozen script alongside primary tests; they were not newly selected in this reporting turn. BH spans 21 tests, with untestable entries counted as p=1. The glutathione synthesis/recycling set contains 12 members before mapping and cannot reach the frozen minimum size 15: its q=1 is bookkeeping, not evidence for a null biological effect. No NADPH or synaptic-energetics set was frozen in this tier; new targeted tests are explicitly separate.\n\n'+md(sec[['pathway','contrast','NES','pval','family_fdr','robustness','test_status']])+'\nExploratory DNA repair and telomere-maintenance results remain in the full archive; neither measures telomere length, damage or protection and neither enters the central claim.\n')
    print(view.to_string(index=False));print(breadth[['pathway','contrast','leading_edge_n','top5_abs_rank_weight_fraction']].to_string(index=False))
if __name__=='__main__': main()
