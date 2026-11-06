# R results bundle

[Download psilocin_results.rds](https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/raw/refs/heads/main/data/derived/psilocin_results.rds). The file contains plain R lists and data frames and needs only base R to read.

```r
results <- readRDS("psilocin_results.rds")
results$contents
results$tables$transcriptomics$primary_day1_vs_control_genes
results$tables$camera_sensitivity$all_tests
results$tables$bayesian_oxphos$posterior_summary
results$metadata$schmidt_analysis_units
results$column_dictionary
results$provenance$inputs
```

## Contents

- **Primary gene results:** all genes in the three primary contrasts, with original identifiers, estimates, uncertainty and missing values retained.
- **Pathway results:** complete enrichment and pathway-sensitivity summaries, leading-edge information, targeted redox tests, DNA-maintenance follow-up and OXPHOS alias analysis.
- **CAMERA:** all CSV tables, retaining both correlation settings, all tests and gene-level statistics.
- **Bayesian OXPHOS:** all six summary/input CSVs, including all ten model specifications, prior settings, computational attempts and predictive summaries.
- **Metadata:** all eleven published metadata CSVs, including source-library mappings, pooled analysis units, design and gene annotations.
- **Documentation:** table index, column types and definitions of common statistical fields, table-specific source references, SHA-256/MD5 checksums and the upstream provenance manifest.

Names follow the original directories and filenames without the `.csv` extension. `contents` gives the exact source path and dimensions of every included table. `column_dictionary` links table-specific fields to their original specification or report; source metadata with unresolved semantics remain unresolved.

The full sensitivity gene/rank tables, large per-block gene-direction table, posterior draws, raw inputs and fitted model objects remain separate. They are available through the existing repository tables, provenance and reproduction scripts. CSV/TSV files remain the canonical, software-independent results.

## Interpretation

`family_fdr` uses each analysis's declared test family; it must not be treated as a correction across the whole bundle. DESeq2 `log2FoldChange` and limma `log2FC` refer to their respective fitted contrasts. Bayesian probabilities and intervals describe expression-score parameters conditional on their models and priors. They do not measure mitochondrial function or telomere protection. Both CAMERA specifications and all Bayesian settings are retained.

## Provenance and rebuilding

This convenience export was added to maintained `main` after the fixed [v1.2.0 archive](https://doi.org/10.5281/zenodo.23283595). It repackages existing results and is not included in that historical archive. Individual source hashes identify its inputs; no new statistical analysis is performed.

From the repository root:

```sh
Rscript src/export_r_results.R
Rscript tests/test_r_results_bundle.R
```

Building requires the existing `digest` R dependency for SHA-256. Reading and verification use base R. The file uses serialization format 2 and xz compression. The [file-level licence map](../FILE_LICENSES.json) records the combined provenance of its inputs; upstream notices remain in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
