"""Describe existing OXPHOS leading edges; no new hypothesis tests."""
import csv
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def read(p):
 with (ROOT/p).open() as f:return list(csv.DictReader(f))
ids={r['symbol']:r['gene_id'] for r in read('tables/transcriptomics/gene_mapping.csv') if r['selected']=='TRUE'}
rows=[]
for r in read('tables/transcriptomics/enrichment_primary_model.csv'):
 if r['pathway']!='HALLMARK_OXIDATIVE_PHOSPHORYLATION':continue
 c=r['contrast'];g={x['gene_id']:x for x in read(f'tables/transcriptomics/primary_{c}_genes.csv')}
 selected=[g[ids[s]] for s in r['leadingEdge'].split(';')]
 def under(x,k):
  try:return float(x[k])<.05
  except ValueError:return False
 rows.append(dict(contrast=c,leading_edge_n=len(selected),positive_log2fc_n=sum(float(x['log2FoldChange'])>0 for x in selected),gene_fdr_below_005_n=sum(under(x,'padj') for x in selected),nominal_p_below_005_n=sum(under(x,'pvalue') for x in selected),scope='Selected leading-edge genes; original transcriptome-wide gene FDR; not independent evidence'))
with (ROOT/'tables/transcriptomics/oxphos_gene_evidence_summary.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=rows[0]);w.writeheader();w.writerows(rows)
print(rows)
