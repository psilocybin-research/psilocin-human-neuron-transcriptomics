"""Reproduce the frozen posterior from verified, supplied full-set scores.

This route verifies derived scientific inputs without requiring an identical RDS
serialization. It neither changes nor bypasses the original workspace audit:
that separate audit remains in bayesian_oxphos.verify_freeze().
"""
import os
for variable in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS'):
    os.environ[variable] = '1'
import argparse
from concurrent.futures import ProcessPoolExecutor
import contextlib
import hashlib
import json
import multiprocessing
from pathlib import Path
import numpy as np
import pandas as pd
from src.transcriptomics import bayesian_oxphos as original

ROOT = Path(__file__).resolve().parents[2]


def verified_inputs(root=ROOT):
    manifest = json.loads((root/'provenance/bayesian_score_inputs_v1.json').read_text())
    for name, digest in manifest['files'].items():
        path = root/name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f'Score reproduction input missing or changed: {name}')
    cfg = json.loads((root/'config/bayesian_oxphos_v1.json').read_text())
    profiles = pd.read_csv(root/'tables/bayesian_oxphos/profile_scores.csv')
    membership = pd.read_csv(root/'tables/bayesian_oxphos/membership.csv')
    if len(membership) != 182 or membership.symbol.duplicated().any() or membership.gene_id.duplicated().any():
        raise ValueError('Expected 182 unique mapped OXPHOS members')
    y = original.paired_scores(profiles, cfg['blocks'], cfg['conditions'])
    # This independent archive table contains per-gene differences for the fixed set.
    previous_root = original.ROOT
    try:
        original.ROOT = root
        original.validate_gene_differences(y, membership, cfg['blocks'], cfg['conditions'])
    finally:
        original.ROOT = previous_root
    mapping = pd.read_csv(root/'tables/transcriptomics/gene_mapping.csv')
    sets = json.loads((root/'config/gene_sets.yaml').read_text())['sets']
    genes = next(item['genes'] for item in sets if item['id'] == cfg['pathway'])
    expected = mapping[mapping.selected & mapping.symbol.isin(genes)]
    if set(zip(expected.gene_id, expected.symbol)) != set(zip(membership.gene_id, membership.symbol)):
        raise ValueError('Mapped membership differs from the primary archive')
    return cfg, y


def worker(job):
    # Initialize library logging before redirecting temporary per-fit streams.
    # Otherwise a reused process can retain a handler pointing at a closed log.
    import pymc  # noqa: F401
    effect, residual, likelihood, output = job
    cfg, y = verified_inputs()
    original.DRAWS = Path(output)/'draws'
    name = f'{likelihood}_effect{effect:g}_residual{residual:g}'
    with (Path(output)/f'{name}.log').open('w') as stream:
        with contextlib.redirect_stdout(stream), contextlib.redirect_stderr(stream):
            result = original.fit(y, cfg, effect, residual, likelihood)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--workers', type=int, default=1)
    args = parser.parse_args()
    cfg, y = verified_inputs()
    if args.verify_only:
        print(json.dumps({'score_inputs_verified': True, 'mapped_genes': 182,
                          'biological_blocks': len(y), 'original_RDS_required': False}))
        return
    if args.output_dir is None or not 1 <= args.workers <= 10:
        parser.error('Provide a new --output-dir and --workers between 1 and 10')
    output = args.output_dir.resolve()
    if output.exists():
        raise ValueError('Output directory already exists; preserve earlier reproductions')
    output.mkdir(parents=True)
    jobs = [(e, s, 'normal', str(output)) for e in cfg['prior_effect_sd'] for s in cfg['prior_residual_sd']]
    jobs.append((.5, .5, 'student_t4', str(output)))
    with ProcessPoolExecutor(max_workers=args.workers, mp_context=multiprocessing.get_context('spawn')) as pool:
        results = list(pool.map(worker, jobs))
    posterior = pd.DataFrame([row for result in results for row in result['posterior']])
    diagnostic = pd.DataFrame([dict(fit=result['fit'], **row) for result in results for row in result['attempts']])
    posterior.to_csv(output/'posterior_summary.csv', index=False)
    diagnostic.to_csv(output/'diagnostics.csv', index=False)
    pd.DataFrame([row for result in results for row in result['predictive']]).to_csv(output/'predictive_checks.csv', index=False)
    published = pd.read_csv(ROOT/'tables/bayesian_oxphos/posterior_summary.csv')
    keys = ['fit', 'parameter']
    fields = ['mean', 'median', 'lower95', 'upper95', 'probability_gt_zero']
    a, b = posterior.set_index(keys).sort_index(), published.set_index(keys).sort_index()
    if not a.index.equals(b.index):
        raise ValueError('Reproduction result keys differ')
    delta = float(np.max(np.abs(a[fields].to_numpy() - b[fields].to_numpy())))
    record = {'route': 'verified derived scores; unchanged original sampler',
              'declared_fits': len(results), 'all_final_fits_valid': all(r['attempts'][-1]['passed'] for r in results),
              'maximum_absolute_summary_difference': delta,
              'workers': args.workers, 'original_RDS_required': False,
              'files': {str(p.relative_to(output)): hashlib.sha256(p.read_bytes()).hexdigest()
                        for p in sorted(output.rglob('*')) if p.is_file()}}
    (output/'reproduction.json').write_text(json.dumps(record, indent=2)+'\n')
    print(json.dumps({k: v for k, v in record.items() if k != 'files'}), flush=True)
    if not record['all_final_fits_valid']:
        raise RuntimeError('At least one reproduced fit failed diagnostics; inspect retained attempts')


if __name__ == '__main__':
    main()
