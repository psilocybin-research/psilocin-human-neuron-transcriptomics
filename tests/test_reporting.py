"""Guard scientific reporting against missing checks and false robust labels."""
import hashlib
import json
import numpy as np
import pandas as pd
import pytest
from src.transcriptomics.report_results import classify, verify, ROOT


def test_significance_does_not_override_block_reversal():
    assert classify(1e-15, 2., np.array([2.,-1.,2.]), np.array([2.,2.,2.]))=='block-dependent'


def test_missing_or_reversed_quality_result_is_not_robust():
    for quality in [np.array([2.,np.nan,2.]),np.array([2.,-1.,2.])]:
        assert classify(.01,2.,np.array([2.,2.,2.]),quality)=='directionally consistent but uncertain'


def test_nonsignificant_consistent_effect_is_not_robust():
    assert classify(.2,2.,np.array([2.,2.,2.]),np.array([2.,2.,2.]))=='directionally consistent but uncertain'


@pytest.mark.skipif(not (ROOT/'tables/transcriptomics/enrichment_all.csv').exists(), reason='Reporting outputs absent; audit-only setup')
def test_primary_freeze_and_rebuild_hashes_unchanged():
    freeze=json.loads((ROOT/'provenance/analysis_freeze.json').read_text())
    for p,h in freeze['sha256'].items():
        path=ROOT/p
        if not path.exists():
            assert p.startswith(('data/raw/','data/processed/')), p
            continue
        assert hashlib.sha256(path.read_bytes()).hexdigest()==h, p


@pytest.mark.skipif(not (ROOT/'tables/targeted_redox/all_tests.csv').exists(), reason='Targeted outputs absent; audit-only setup')
def test_targeted_family_and_sensitivity_grain():
    t=pd.read_csv(ROOT/'tables/targeted_redox/all_tests.csv')
    assert not t.duplicated(['module','contrast','variant']).any()
    assert len(t)==80
    assert (t.groupby('variant').size()==8).all()
    assert set(t.variant)=={'primary','omit_68_3__batch1','omit_68_3__batch2','omit_69_2__batch1','RIN_covariate','RIN_ge6','one_library_per_group','block_68_3__batch1','block_68_3__batch2','block_69_2__batch1'}
    for variant, s in t[~t.variant.str.startswith('block_')].groupby('variant'):
        # Independent BH recomputation across exactly eight tests.
        order=np.argsort(s.pval.fillna(1).values)
        raw=s.pval.fillna(1).values[order]*8/np.arange(1,9)
        expected=np.minimum(1,np.minimum.accumulate(raw[::-1])[::-1])
        np.testing.assert_allclose(s.family_fdr.values[order],expected)
