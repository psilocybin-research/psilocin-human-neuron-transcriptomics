"""Reconstruct control evidence without assigning undocumented harvest days."""
import json,re
from pathlib import Path
import pandas as pd
from bs4 import BeautifulSoup
from src.acquisition.download import ROOT


def main():
    base=ROOT/'data/raw/schmidt'
    def blobs(p): return {r['path']:r['sha'] for r in json.loads(p.read_text())['tree'] if r['type']=='blob'}
    current=blobs(base/'github_tree.json')
    archived=blobs(base/'control_search/archived_github_tree.json')
    initial=blobs(base/'control_search/initial_github_tree.json')
    rows=[]
    for p in sorted(current):
        rows.append(dict(path=p,current_blob=current[p],archive_blob=archived.get(p,''),initial_blob=initial.get(p,''),
                         unchanged_since_initial=current[p]==initial.get(p)))
    pd.DataFrame(rows).to_csv(ROOT/'metadata/schmidt_archive_comparison.csv',index=False)
    swh={}
    def walk(file,prefix=''):
        for r in json.loads(file.read_text()):
            name=prefix+r['name']
            if r['type']=='dir':walk(base/'control_search'/('swh_'+r['target']+'.json'),name+'/')
            else:swh[name]=r['target']
    walk(base/'control_search/software_heritage_directory.json')
    assert swh==archived,'Archive content differs; inspect before decision'
    md=pd.read_excel(base/'github/raw_data/IlseID29538/IlseID29538_metadata.xlsx')
    rds=pd.read_csv(ROOT/'data/interim/schmidt/reference/rds_coldata.csv')
    assert set(md.ODCF_name)==set(rds.ODCF_name)
    assert md.timepoint_d.isna().all() and rds.timepoint_d.isna().all()
    records=[]
    for _,r in md.iterrows():
        ctrl=r.Condition_simple=='Ctrl'
        match=re.match(r'([13])D_',str(r.Condition).strip())
        day=int(match[1]) if match else None
        records.append(dict(sample_id=r.ODCF_name,cell_line=r.Cell_line,batch=r.Batch,
            technical_replicate_label=r.Condition,technical_replicate_status='unresolved well/RNA/run identity; source technical samples nested in differentiation',
            treatment=r.Condition_simple,condition_text=r.Condition,harvest_day=day,
            harvest_day_confidence='confirmed' if day else 'unresolved',
            control_relationship='pooled common Ctrl factor; no per-day allocation' if ctrl else 'compared with common Ctrl factor in source code',
            control_relationship_confidence='confirmed as coded; biological day matching unresolved',
            block_interpretation_confidence='strongly inferred',
            evidence='Excel + cached RDS colData + all three unchanged Rmd scripts; MDAR and Dryad batch definition',
            metadata_identity_confidence='confirmed'))
    pd.DataFrame(records).to_csv(ROOT/'metadata/schmidt_control_resolution.csv',index=False)
    checks=[]
    for p in [base/'article.json',base/'article.xml',base/'dryad_metadata.json',base/'dryad_landing.html',*sorted((base/'github/r-scripts').glob('*.Rmd'))]:
        txt=p.read_text()
        accessions=sorted(set(re.findall(r'\b(?:GSE\d+|GSM\d+|PRJNA\d+|SRP\d+|ERP\d+|E-MTAB-\d+)\b',txt)))
        checks.append(dict(file=str(p.relative_to(ROOT)),sequencing_accessions=accessions))
    (ROOT/'metadata/schmidt_accession_search.json').write_text(json.dumps(checks,indent=2)+'\n')
    summary={'decision':'B','control_library_days_recovered':False,'control_libraries':int((md.Condition_simple=='Ctrl').sum()),
        'all_metadata_timepoint_d_missing':True,'software_heritage_equals_archived_github':swh==archived,
        'analysis_blobs_unchanged_since_initial':all(current[p]==initial.get(p) for p in current if p not in ['LICENSE','README.md']),
        'scope':'public supplied metadata/code/archive; no author contact; absence of labels does not prove unmatched control collection'}
    (ROOT/'metadata/schmidt_control_resolution.json').write_text(json.dumps(summary,indent=2)+'\n')

if __name__=='__main__':main()
