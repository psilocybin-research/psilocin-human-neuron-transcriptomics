"""Family size, subtraction, annotation and identity checks for the post hoc tier."""
import hashlib,json
from pathlib import Path
import numpy as np
import pandas as pd
import pytest
ROOT=Path(__file__).resolve().parents[1]
pytestmark=pytest.mark.skipif(not (ROOT/'tables/dna_maintenance/primary_tests.csv').exists(),reason='Follow-up outputs absent')

def test_subtraction_removes_full_membership_and_freeze_is_intact():
    for record in ['analysis_freeze.json','dna_maintenance_freeze_v1.json']:
        for p,h in json.loads((ROOT/'provenance'/record).read_text())['sha256'].items():
            path=ROOT/p
            if not path.exists():
                assert p.startswith(('data/raw/','data/processed/')), p
                continue
            assert hashlib.sha256(path.read_bytes()).hexdigest()==h
    sets={s['id']:set(s['genes']) for s in json.loads((ROOT/'config/gene_sets.yaml').read_text())['sets']}
    cfg=json.loads((ROOT/'config/dna_maintenance_v1.json').read_text())
    for m in cfg['modules'][:4]:
        excluded=sets['HALLMARK_OXIDATIVE_PHOSPHORYLATION']|sets['HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY'] if m['id'].endswith('OXPHOS_ROS') else sets['HALLMARK_DNA_REPAIR' if m['id'].startswith('TELOMERE') else 'REACTOME_TELOMERE_MAINTENANCE']
        assert set(m['genes'])==sets[m['parent']]-excluded
        assert set(m['excluded_genes'])==sets[m['parent']]&excluded

def test_all_variants_use_the_entire_24_test_family():
    x=pd.read_csv(ROOT/'tables/dna_maintenance/all_tests.csv')
    assert len(x)==240 and not x.duplicated(['module','variant','contrast']).any()
    assert (x.groupby('variant').size()==24).all()
    assert x[x.variant.str.startswith('block_')].family_fdr.isna().all()
    for _,s in x[~x.variant.str.startswith('block_')].groupby('variant'):
        order=np.argsort(s.pval.fillna(1).values)
        expected=np.minimum(1,np.minimum.accumulate((s.pval.fillna(1).values[order]*24/np.arange(1,25))[::-1])[::-1])
        np.testing.assert_allclose(s.family_fdr.values[order],expected)

def test_decomposition_is_complete_multivalued_and_matches_gene_ids():
    x=pd.read_csv(ROOT/'tables/dna_maintenance/telomere_decomposition.csv')
    assert x.gene.is_unique and len(x)==30
    assert x.day1_le.sum()==27 and x.day3_le.sum()==25 and (x.day1_le&x.day3_le).sum()==22
    assert set(x.loc[x.modules.str.contains('Packaging'),'gene'])=={'ACD','TERF2','TINF2'}
    assert ';' in x.set_index('gene').loc['ACD','modules']
    g=pd.read_csv(ROOT/'tables/transcriptomics/primary_day1_vs_control_genes.csv').set_index('gene_id')
    for r in x.itertuples():
        assert g.loc[r.gene_id,'symbol']==r.gene
        assert np.isclose(g.loc[r.gene_id,'log2FoldChange'],r.day1_log2fc)
    panel=pd.read_csv(ROOT/'tables/dna_maintenance/canonical_panel.csv')
    assert panel[panel.gene=='TERT'].log2FoldChange.isna().all()
