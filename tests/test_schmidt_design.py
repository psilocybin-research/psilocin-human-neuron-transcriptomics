import numpy as np
import pandas as pd
import pytest

from src.audit.schmidt_design import annotate_core, pool_counts, design_matrix


def example_metadata():
    return pd.DataFrame({
        'ODCF_name':['c1','c2','d1','d3'], 'Cell_line':['lineA']*4, 'Batch':[1]*4,
        'Condition_simple':['Ctrl','Ctrl','Trt5','Trt3'],
        'Condition':['Ctrl_1','Ctrl_2','1D_10µM_Psi_10min_1','3D_10µM_Psi_10min_1'],
        'Psi_conc_uM':[0,0,10,10], 'Psi_trt_time_min':[0,0,10,10],
        'Ket_conc_uM':[0]*4, 'Ket_trt_time_min':[0]*4, 'PLG_trt_time_min':[0]*4})


def test_control_time_is_not_invented():
    core = annotate_core(example_metadata())
    assert core.loc[core.condition == 'control', 'post_exposure_day'].isna().all()
    assert core.loc[core.ODCF_name == 'd3','post_exposure_day'].iloc[0] == 3


def test_mismatched_time_label_is_rejected():
    metadata = example_metadata()
    metadata.loc[2,'Condition'] = '3D_10µM_Psi_10min_1'
    with pytest.raises(ValueError, match='assigned day'):
        annotate_core(metadata)


@pytest.mark.parametrize('field,value', [('Psi_trt_time_min',1440), ('Ket_conc_uM',75)])
def test_wrong_exposure_or_cotreatment_is_rejected(field, value):
    metadata = example_metadata()
    metadata.loc[2,field] = value
    with pytest.raises(ValueError):
        annotate_core(metadata)


def test_pooling_conserves_counts_and_keeps_conditions_separate():
    meta = annotate_core(example_metadata())
    counts = pd.DataFrame({'d3':[30,60], 'c2':[2,4], 'd1':[10,20], 'c1':[1,2]},index=['g1','g2'])
    pooled = pool_counts(counts,meta)
    assert pooled['lineA__batch1__control'].tolist() == [3,6]
    assert pooled['lineA__batch1__psilocin_day1'].tolist() == [10,20]
    assert pooled.to_numpy().sum() == counts.to_numpy().sum()


def test_pooling_cannot_cross_blocks():
    meta = annotate_core(example_metadata())
    meta.loc[1,'block'] = 'different_batch'
    counts = pd.DataFrame([[1,2,3,4]], columns=meta.ODCF_name,index=['g'])
    with pytest.raises(ValueError, match='crosses block'):
        pool_counts(counts,meta)


def test_three_block_three_condition_design_has_four_residual_df():
    units = pd.DataFrame([(b,c) for b in ['a','b','c']
                          for c in ['control','psilocin_day1','psilocin_day3']],columns=['block','condition'])
    matrix = design_matrix(units)
    assert matrix.shape == (9,5)
    assert np.linalg.matrix_rank(matrix) == 5
