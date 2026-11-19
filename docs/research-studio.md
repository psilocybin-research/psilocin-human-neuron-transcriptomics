# Research Studio

R Studio is the default computing workspace. Code runs only on request. Python Lab loads its independent Python runtime when initialized or run; opening R does not initialize Python. Both environments read the same six archived CSV tables. User outputs remain separate from archived findings.

## Notebooks and execution

R notebooks contain inline R and Markdown cells, recorded output, tables, figures and optional scientific scenes. Cell actions provide duplication, movement, output clearing and deletion. Run all executes R cells in notebook order and stops on a recorded error. Isolated sessions are the default; explicit session sharing retains objects until reset, interruption, an error, a notebook change or navigation. Archived tables and the seed refresh on each run. The previous `results` object is cleared.

Use the workspace tools for recipes, CSV imports and runtime settings. Imported UTF-8 CSV files are limited to 2 MB, 1,000 rows and 100 columns and become `user_data`. A file is not uploaded. Python results use a list of dictionaries named `results`; table values require explicit type conversion. Cross-language transfer carries CSV and provenance rather than runtime objects.

## Scientific scene helpers

R and Python expose `atlas_scatter3d(data, x, y, z, color, id, title)`, `atlas_network(data, value, id, title)` and `atlas_structure(gene, title)`. R uses named character arguments, for example:

```r
results <- subset(genes, selected & contrast == "day1_vs_control")
results <- results[is.finite(results$log2FoldChange) &
                   is.finite(results$lfcSE) & is.finite(results$baseMean), ]
atlas_scatter3d(results, "log2FoldChange", "lfcSE", "baseMean",
                color = "log2FoldChange")
```

`atlas_scene(spec)` accepts a versioned specification. `atlas_overlay()` requests the membership overlay; `atlas_mitochondria()` requests an explicitly schematic respiratory-complex membership view. These helpers do not create anatomical geometry. One scene is retained per executed cell; the last helper call wins. Structure requests open existing, source-qualified molecular context rather than inferring a protein model.

Scatter specifications carry exact values, explicit axes, classification and source metadata. Display coordinates are normalized independently; Euclidean scene distance has no biological interpretation. Membership overlays require exact Ensembl identifiers. Duplicate identifiers, unsupported relations and nonfinite scene coordinates are rejected. Archived expression does not measure protein abundance, conformation or activity.

Molecular systems is available through the scientific search commands and R Studio's More menu. It offers archived functional/complex memberships, typed gene–pathway–complex layers, selected-gene networks and illustrative neuron navigation. Neuron landmarks contain no inferred gene localization. Day views share a fixed archived colour domain.

## Saving and reconstruction

Notebooks save on the current device. Restoring them never executes code. Export provides notebook JSON, HTML, nonexecuting Quarto/R Markdown sources, R code and supported current-run artifacts. The Reports workspace exports a checksummed research-session ZIP containing recorded notebooks, exact available input CSVs, scenes, selections, projects and native replay scripts. Session import verifies the archive before requesting replacement of local research material.

Replay is explicit: inspect the exported scripts, then run them in the supplied replay directories. Recorded input hashes identify required bytes. Runs with unavailable historical inputs are marked nonreconstructable and their generated scripts fail explicitly. Native package environments, external resources or arbitrary user-created files may require additional dependencies. The archive is not a validated RO-Crate.

Scientific scenes export exact JSON/CSV, camera settings and a labelled PNG. Notebook document exports retain scene definitions; they do not embed an interactive WebGL application. The immutable scientific archive is [Zenodo v1.2.0](https://doi.org/10.5281/zenodo.23283595).
