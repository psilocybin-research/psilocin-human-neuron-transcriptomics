# Reproducing the post hoc Bayesian OXPHOS analysis

The supplementary archive supplies the fixed full-set profile scores, memberships, original primary gene-level differences, statistical specification, unchanged sampler, dependency lock and complete numerical summaries. It reproduces the posterior from these derived inputs without requiring the original serialized DESeq2 object. These materials are included in computational companion version 1.1.0; version 1.0.1 remains the historical analysis archive.

## Score-to-posterior reproduction

Extract the archive into a clean directory, preserving its relative paths. Python 3.10.12 was used. Install a C++ compiler and development headers matching the Python interpreter, then install the pinned Python dependencies in an isolated environment:

```bash
python3 -m venv .venv-bayes
.venv-bayes/bin/python -m pip install -r requirements.bayes.lock.txt
.venv-bayes/bin/python -m src.transcriptomics.reproduce_bayesian_scores --verify-only
.venv-bayes/bin/python -m unittest discover -s tests -p 'test_bayesian*.py'
.venv-bayes/bin/python -m src.transcriptomics.reproduce_bayesian_scores --output-dir reproduction --workers 1
```

Use `virtualenv .venv-bayes` if the operating system does not provide venv/ensurepip. The output directory must not already exist: each reproduction preserves its own complete draws, predictive arrays, diagnostics, logs and summaries. `--workers` may be increased on a sufficiently provisioned computer; only independent models run concurrently. Every fit retains four sequential chains, one numerical thread, original seeds and all frozen sampler/remedy settings.

The score-input manifest checks the unchanged sampler, locally frozen specification, original gene-set membership, gene mapping, per-gene differences and profile-score inputs. The runner also checks one-to-one profile pairing and exact 182-gene membership, then compares every block/contrast score difference with the mean of the archived per-gene differences at tolerance 1e-12. No genes or libraries are counted as additional biological replicates.

All nine normal-prior combinations and the Student-t sensitivity are fitted. The reproduction records numerical differences from the supplied posterior summaries and whether each final fit passes the declared diagnostics. Floating-point and MCMC output may vary across hardware or library/compiler versions; discrepancies require inspection rather than replacement of the reported estimates. The supplied original summaries remain untouched.

The interval figure can be regenerated with `.venv-bayes/bin/python -m src.transcriptomics.plot_bayesian_oxphos`.

## Scope of this route

The derived inputs are sufficient to reproduce the Bayesian posterior. They do not independently rederive the normalized counts from raw reads or validate the source experiment. The versioned computational companion supplies the source-count acquisition and original RNA-seq analysis instructions. `export_bayesian_oxphos.R` records how scores were exported from the original DESeq2 object; that original-workspace audit requires its exact RDS checksum and remains separate. The score-based runner preserves the original freeze and does not claim a newly reconstructed RDS has identical binary serialization.

The original plan, score definition, priors, diagnostic thresholds, remedy and assumptions are in `reports/bayesian_oxphos_plan_v1.md`. Full supplementary methods and prior sensitivity are in `reports/bayesian_oxphos_methods.md`. The model has three differentiation-block observations across two backgrounds; convergence and successful reproduction do not establish population generalization or resolve missing control harvest days. No ROPE is used because no scientifically calibrated equivalence range exists for this expression score.

## Verification on 10 October 2026

A clean checkout of the computational companion overlaid with this extension, with no original RDS present, reran all ten declared models using the existing locked Python environment. Every final fit passed the declared diagnostics, and posterior summaries matched the supplied results to numerical precision (maximum absolute difference 2.23e-16). The unchanged sampler SHA-256, source commit and verification scope are recorded in `provenance/bayesian_score_reproduction_check.json`. This verifies score-to-posterior reproduction; source-count-to-score reconstruction was not repeated.
