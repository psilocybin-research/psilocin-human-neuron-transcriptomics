"""Create one immutable, pre-results plan snapshot; never refresh silently."""
import json
from datetime import datetime,timezone
from src.acquisition.download import ROOT,sha256


def main():
    dest=ROOT/'provenance/analysis_freeze.json'
    if dest.exists():raise ValueError('Freeze already exists; record an explicit amendment')
    if (ROOT/'tables/transcriptomics/enrichment_all.csv').exists():raise ValueError('Primary results already exist')
    files=['config/analysis.yaml','config/gene_sets.yaml','reports/analysis_plan_frozen.md',
        'reports/schmidt_control_resolution.md','reports/schmidt_rnaseq_qc.md','reports/schmidt_reproduction_check.md',
        'renv.lock','requirements.lock.txt','src/transcriptomics/analyze.R','src/transcriptomics/helpers.R',
        'src/audit/schmidt_design.py','metadata/schmidt_core_samples.csv','metadata/schmidt_analysis_units.csv',
        'metadata/schmidt_gene_annotation.csv','data/processed/schmidt/core_block_condition_counts.tsv.gz']
    records=json.loads((ROOT/'metadata/provenance.json').read_text())
    files += [r['local_filename'] for r in records if r['local_filename'].startswith(('data/raw/gene_sets/','data/raw/schmidt/github/raw_data/'))]
    obj={'version':'1.0','frozen_utc':datetime.now(timezone.utc).isoformat(),'status':'before primary differential expression and enrichment','sha256':{p:sha256(ROOT/p) for p in files}}
    dest.write_text(json.dumps(obj,indent=2)+'\n')

if __name__=='__main__':main()
