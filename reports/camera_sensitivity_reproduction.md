# Reproduce the correlation-aware sensitivity

Use the original pinned R environment (R 4.6.1, DESeq2 1.52.0, jsonlite 2.0.0, digest 0.6.39) documented in the repository setup. The added dependencies are limma 3.68.5 and statmod 1.5.2. Software provenance contains exact URLs and checksums; upstream package sources are restored explicitly, not redistributed.

```sh
python3 src/acquisition/restore_camera_software.py
mkdir -p .Rlib-camera
R CMD INSTALL --library=.Rlib-camera data/raw/software/statmod_1.5.2.tar.gz
R_LIBS=.Rlib-camera R CMD INSTALL --library=.Rlib-camera data/raw/software/limma_3.68.5.tar.gz
Rscript tests/test_camera_sensitivity.R
Rscript src/transcriptomics/camera_sensitivity_v1_1.R
python3 -m unittest discover -s tests -p 'test_camera_results.py'
Rscript src/transcriptomics/audit_camera_implementation.R
Rscript src/transcriptomics/verify_camera_runtime_df.R
```

The frozen runner verifies exact hashes before fitting. It reads the included nine-profile **derived pooled count matrix**, not a primary RDS or raw upstream libraries. Both the original v1 runner and the export-only amendment remain archived. The fitted RDS is created locally when the runner is executed; it is required by the two audit commands but is not redistributed. Output tables retain all 30 tests with separate 15-test BH correction in each setting, complete symbol mappings, normalization, gene statistics, warnings, session information and the voom mean–variance diagnostic.

The isolated-directory reproduction matched seven numerical CSV files byte for byte using the same installed dependencies; this did not independently restore a fresh operating-system environment. Direct runtime tracing verified CAMERA reference df of 4 for estimated correlation and 21,096 for fixed correlation, and reproduced all 30 stored results to floating-point precision. Trace removal is guaranteed on completion or error. Four residual model df remain in both modes; reference df do not add biological replication.

The source packages retain their own GPL terms (limma GPL >=2; statmod GPL-2 or GPL-3), documented in metadata/camera_software_license_verified.json. The original primary results and experimental design limits are unchanged. See [methods](camera_sensitivity_methods.md) and [all results](camera_sensitivity_results.md).
