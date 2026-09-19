"""Build audited core design and conservatively pooled counts; no model fitting."""

import json
from pathlib import Path

import numpy as np
import pandas as pd

from src.acquisition.download import ROOT, sha256
from src.audit.inventory import align_samples, require_unique, verify_manifest

CORE_CONDITIONS = {'Ctrl': ('control', None), 'Trt5': ('psilocin_day1', 1),
                   'Trt3': ('psilocin_day3', 3)}


def annotate_core(metadata: pd.DataFrame) -> pd.DataFrame:
    """Map source condition labels; preserve unknown control harvest time."""
    require_unique(metadata, ['ODCF_name'])
    frame = metadata[metadata.Condition_simple.isin(CORE_CONDITIONS)].copy()
    if frame[['Cell_line', 'Batch']].isna().any().any():
        raise ValueError('Missing biological block label')
    frame['block'] = frame.Cell_line.astype(str) + '__batch' + frame.Batch.astype(int).astype(str)
    frame['condition'] = frame.Condition_simple.map(lambda value: CORE_CONDITIONS[value][0])
    frame['post_exposure_day'] = pd.array(frame.Condition_simple.map(lambda value: CORE_CONDITIONS[value][1]), dtype='Int64')
    for _, row in frame.iterrows():
        if row.condition == 'control':
            if row.Psi_conc_uM != 0 or row.Psi_trt_time_min != 0:
                raise ValueError('Control coding disagrees with psilocin exposure')
        else:
            day = int(row.post_exposure_day)
            if not str(row.Condition).strip().startswith(f'{day}D_'):
                raise ValueError('Condition text disagrees with assigned day')
            if row.Psi_conc_uM != 10 or row.Psi_trt_time_min != 10:
                raise ValueError('Primary condition is not 10 min / 10 micromolar')
        if row.Ket_conc_uM != 0 or row.Ket_trt_time_min != 0 or row.PLG_trt_time_min != 0:
            raise ValueError('Co-treatment entered primary condition')
    frame['analysis_unit'] = frame.block + '__' + frame.condition
    frame['biological_unit_status'] = 'conservative line-by-batch grouping; MDAR definition applied to Batch'
    frame['control_time_status'] = np.where(frame.condition == 'control',
                                            'not assigned per RNA library', 'source condition label + published contrast')
    return frame


def pool_counts(counts: pd.DataFrame, metadata: pd.DataFrame) -> pd.DataFrame:
    """Sum nested libraries within audited line/batch/condition groups only."""
    if counts.index.has_duplicates or counts.columns.has_duplicates:
        raise ValueError('Duplicate gene or sample IDs')
    if set(counts.columns) != set(metadata.ODCF_name):
        raise ValueError('Count/metadata sample sets differ')
    require_unique(metadata, ['ODCF_name'])
    values = counts.to_numpy()
    if not np.isfinite(values).all() or (values < 0).any() or (values != np.floor(values)).any():
        raise ValueError('Invalid raw counts')
    outputs = {}
    for unit, group in metadata.groupby('analysis_unit', sort=True):
        for label in ['block', 'condition', 'Cell_line', 'Batch']:
            if group[label].nunique(dropna=False) != 1:
                raise ValueError(f'Pooling crosses {label}')
        outputs[unit] = counts[group.ODCF_name.tolist()].sum(axis=1)
    result = pd.DataFrame(outputs).astype('int64')
    if int(result.to_numpy().sum()) != int(values.sum()):
        raise ValueError('Pooling failed to conserve counts')
    return result


def design_matrix(units: pd.DataFrame) -> pd.DataFrame:
    """Construct a blocked condition design, with control as the reference."""
    frame = units.copy()
    frame['condition'] = pd.Categorical(frame.condition, ['control', 'psilocin_day1', 'psilocin_day3'])
    matrix = pd.get_dummies(frame[['block','condition']], drop_first=True, dtype=float)
    matrix.insert(0, 'Intercept', 1.0)
    return matrix


def main() -> None:
    verify_manifest("data/raw/schmidt/github/")
    base = ROOT / 'data/raw/schmidt/github/raw_data/IlseID29538'
    original = pd.read_excel(base / 'IlseID29538_metadata.xlsx')
    paths = sorted((base / 'featureCounts').glob('*.tsv'))
    meta = align_samples(original, [path.name.split('_OE')[0] for path in paths])
    core = annotate_core(meta)
    core.to_csv(ROOT / 'metadata/schmidt_core_samples.csv', index=False)
    excluded = meta.loc[~meta.ODCF_name.isin(core.ODCF_name), ['ODCF_name', 'Condition_simple','Condition']].copy()
    excluded['reason'] = 'co-treatment or PLG condition outside primary comparison; retained in raw inputs'
    excluded.to_csv(ROOT / 'metadata/schmidt_core_exclusions.csv', index=False)
    units = core.groupby('analysis_unit', sort=True).agg(
        block=('block','first'), condition=('condition','first'), Cell_line=('Cell_line','first'),
        Batch=('Batch','first'), libraries_n=('ODCF_name','size'),
        RIN_min=('RIN','min'), RIN_max=('RIN','max'), RIN_mean=('RIN','mean'),
        source_samples=('ODCF_name',lambda s: ';'.join(s))).reset_index()
    require_unique(units, ['block','condition'])
    if not units.groupby('block').condition.apply(lambda s: set(s) == set(v[0] for v in CORE_CONDITIONS.values())).all():
        raise ValueError('Incomplete block; do not silently proceed')
    units.to_csv(ROOT / 'metadata/schmidt_analysis_units.csv', index=False)
    matrix = design_matrix(units)
    matrix.to_csv(ROOT / 'metadata/schmidt_design_matrix.csv', index=False)
    rank = int(np.linalg.matrix_rank(matrix))
    if rank != matrix.shape[1]:
        raise ValueError('Blocked design is rank deficient')
    reference, columns = None, {}
    annotations = None
    for path in paths:
        sample = path.name.split('_OE')[0]
        if sample not in set(core.ODCF_name):
            continue
        table = pd.read_csv(path, sep='\t', usecols=['gene_id','name','num_reads'])
        require_unique(table, ['gene_id'])
        if reference is None:
            reference = table.gene_id.tolist()
            annotations = table[['gene_id','name']].copy()
        elif table.gene_id.tolist() != reference:
            raise ValueError('Gene universe/order mismatch')
        columns[sample] = table.num_reads.to_numpy()
    counts = pd.DataFrame(columns, index=pd.Index(reference, name='gene_id'))
    pooled = pool_counts(counts, core)
    target = ROOT / 'data/processed/schmidt'
    target.mkdir(parents=True, exist_ok=True)
    # Fixed gzip header makes the artifact byte-reproducible across reruns.
    output = target / 'core_block_condition_counts.tsv.gz'
    pooled.to_csv(output, sep='\t', compression={'method':'gzip', 'mtime':0})
    annotations.to_csv(ROOT / 'metadata/schmidt_gene_annotation.csv', index=False)
    scenarios = []
    for block in sorted(units.block.unique()):
        subset = units[units.block != block]
        x = design_matrix(subset)
        scenarios.append({'omitted_block': block, 'units': len(subset),
                          'remaining_genetic_backgrounds': int(subset.Cell_line.nunique()),
                          'design_rank': int(np.linalg.matrix_rank(x)),
                          'residual_df': len(subset)-int(np.linalg.matrix_rank(x))})
    report = {'core_libraries': len(core), 'excluded_libraries': len(excluded),
              'genetic_backgrounds': int(core.Cell_line.nunique()),
              'line_batch_blocks': int(core.block.nunique()), 'analysis_units': len(units),
              'genes': len(pooled), 'design_columns': matrix.columns.tolist(),
              'design_rank': rank, 'nominal_residual_df': len(units)-rank,
              'model_fitted': False, 'control_harvest_times_resolved': False,
              'treated_time_contrast_is_treatment_by_time_interaction': False,
              'pooling': 'conservative aggregation within line x Batch x condition; not evidence of independent donors',
              'counts_sha256': sha256(output), 'leave_one_block_out_designs': scenarios}
    (ROOT / 'metadata/schmidt_design_audit.json').write_text(json.dumps(report, indent=2)+'\n')
    (ROOT / 'metadata/schmidt_counts_transformation.json').write_text(json.dumps({
        'script':'src/audit/schmidt_design.py', 'output':str(output.relative_to(ROOT)),
        'output_sha256':sha256(output),
        'sample_mapping':'metadata/schmidt_core_samples.csv',
        'inputs': [{'path':str(path.relative_to(ROOT)), 'sha256':sha256(path)} for path in paths
                   if path.name.split('_OE')[0] in set(core.ODCF_name)]},indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
