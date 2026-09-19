"""Export immutable result views; no models or enrichment tests are run."""
import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'explorer/src/data'
ARCHIVE_DOI = '10.5281/zenodo.22843281'
SITE_URL = 'https://psilocybin-research.github.io/psilocin-human-neuron-transcriptomics/'
CONTRASTS = ['day1_vs_control','day3_vs_control','day3_vs_day1']
NUMERIC = {'baseMean','log2FoldChange','lfcSE','stat','pvalue','padj','pval','NES','ES','family_fdr','size','estimate','mapped','total','RIN_mean','libraries_n','vst','row_z','day1_log2fc','day3_log2fc','day3_minus_day1_log2fc','day1_gene_fdr','day3_gene_fdr','day1_log2FoldChange','day3_log2FoldChange','day1_stat','day3_stat','spearman','same_sign_fraction','same_sign_n','positive_both_n','zero_either_n','n','dna_n','telomere_n','shared_n','union_n','jaccard','fraction_dna','fraction_telomere','gene_fdr'}
inputs = {}
def read(path):
    p=ROOT/path
    inputs[path]=hashlib.sha256(p.read_bytes()).hexdigest()
    with p.open() as f:
        rows=list(csv.DictReader(f))
    for row in rows:
        for k,v in row.items():
            if k in NUMERIC:
                row[k]=None if v in ('NA','NaN','') else float(v)
            elif v in ('TRUE','FALSE','True','False'):
                row[k]=v in ('TRUE','True')
    return rows

def dump(name,data):
    (OUT/name).write_text(json.dumps(data,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n')

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    selected={r['gene_id'] for r in read('tables/transcriptomics/gene_mapping.csv') if r['selected']}
    genes={}
    for ci,c in enumerate(CONTRASTS):
        for r in read(f'tables/transcriptomics/primary_{c}_genes.csv'):
            gid=r['gene_id']
            if gid not in genes:
                genes[gid]={'id':gid,'symbol':r['symbol'],'selected':gid in selected,'effects':[None]*3}
            genes[gid]['effects'][ci]={k:r[k] for k in ['baseMean','log2FoldChange','lfcSE','stat','pvalue','padj']}
    assert len(genes)==21154 and sum(r['selected'] for r in genes.values())==21098
    assert all(all(x is not None for x in r['effects']) for r in genes.values())
    pathways=read('tables/transcriptomics/enrichment_primary_model.csv')
    sensitivities=read('tables/transcriptomics/enrichment_all.csv')
    landscape=read('tables/transcriptomics/oxphos_leading_edge_function_map.csv')
    profiles=read('tables/transcriptomics/oxphos_display_profiles.csv')
    assert len(landscape)==113 and len(profiles)==113*9
    assert len({(r['gene'],r['profile_id']) for r in profiles})==113*9
    cfg=ROOT/'config/gene_sets.yaml'; inputs[str(cfg.relative_to(ROOT))]=hashlib.sha256(cfg.read_bytes()).hexdigest()
    sets=json.loads(cfg.read_text())['sets']
    membership={s['id']:s['genes'] for s in sets}
    curves={}
    # Reconstruct the same weighted running score for display only, preserving extrema.
    for c in CONTRASTS:
        ranks=read(f'tables/transcriptomics/primary_{c}_ranks.csv')
        ranks.sort(key=lambda r:(-float(r['statistic']),r['symbol']))
        for p in pathways:
            if p['contrast']!=c or p['tier'] not in ('primary','secondary','exploratory') or p['size'] is None or p['size']<15: continue
            symbols=set(membership[p['pathway']]);hits=[i for i,r in enumerate(ranks) if r['symbol'] in symbols]
            weights=sum(abs(float(ranks[i]['statistic'])) for i in hits)
            hitset=set(hits);n=len(ranks);miss=n-len(hits);acc=0;full=[]
            for i,r in enumerate(ranks):
                acc+=abs(float(r['statistic']))/weights if i in hitset else -1/miss
                full.append(acc)
            assert abs(max(full,key=abs)-p['ES'])<1e-6
            keep=set(range(0,n,40))|{n-1,full.index(max(full)),full.index(min(full))}
            curves[p['pathway']+'|'+c]={'points':[[100*(i+1)/n,full[i]] for i in sorted(keep)],'hits':[100*(i+1)/n for i in hits],'ranked_genes':n}
    dump('genes.json',list(genes.values()))
    dump('atlas.json',dict(contrasts=CONTRASTS,pathways=pathways,sensitivities=sensitivities,
        landscape=landscape,profiles=profiles,membership=membership,curves=curves,
        dna=dict(decomposition=read('tables/dna_maintenance/telomere_decomposition.csv'),overlap=read('tables/dna_maintenance/overlap.csv'),concordance=read('tables/dna_maintenance/concordance.csv'),genes=read('tables/dna_maintenance/concordance_genes.csv'),panel=read('tables/dna_maintenance/canonical_panel.csv'),tests=read('tables/dna_maintenance/primary_tests.csv'),sensitivities=read('tables/dna_maintenance/all_tests.csv')),
        aliases=read('tables/oxphos_alias/alias_mapping.csv'),aliasSensitivity=read('tables/oxphos_alias/all_variants.csv'),
        targeted=read('tables/targeted_redox/primary_tests.csv'),blocks=read('tables/transcriptomics/leading_edge_block_directions.csv')))
    freeze=ROOT/'provenance/analysis_freeze.json'
    dump('provenance.json',dict(source='https://github.com/ahoffrichter/Schmidt_et_al_2025',
        article='https://doi.org/10.7554/eLife.104006.3',freeze=json.loads(freeze.read_text()),
        inputs=inputs,outputs={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.glob('*.json') if p.name!='provenance.json'},
        dnaFreeze=json.loads((ROOT/'provenance/dna_maintenance_freeze_v1.json').read_text()),
        archiveDOI=ARCHIVE_DOI,siteURL=SITE_URL))
    print(f'Exported {len(genes)} genes, {len(pathways)} pathway results, {len(profiles)} expression cells; curve ES checks passed.')
if __name__=='__main__': main()
