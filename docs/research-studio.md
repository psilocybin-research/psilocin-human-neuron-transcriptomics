# Workspace

R Studio is the default computing workspace. Code runs only on request. Python Lab loads its independent Python runtime when initialized or run; opening R does not initialize Python. Both environments read the same six archived CSV tables. User outputs remain separate from archived findings.

## Notebooks and execution

R notebooks contain inline R and Markdown cells, recorded output, tables, figures and optional scientific scenes. Cell actions provide duplication, movement, output clearing and deletion. Run all executes R cells in notebook order and stops on a recorded error. Notebook sessions are the default. Variables, including `results`, persist between cells until restart, interruption, an error, a notebook change or navigation. Archived inputs and the seed initialize once per session; immutable source copies are available through the locked `atlas_archive` environment. Input bytes and hashes are cached. Run records retain the random state before and after execution. Independent cell execution remains an explicit option. Restart & run all starts clean. Interruption currently terminates the worker, discarding its objects.

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

`atlas_scene(spec)` accepts a versioned specification. `atlas_overlay()` requests the membership overlay; `atlas_mitochondria()` requests an explicitly schematic respiratory-complex membership view. These helpers do not create anatomical geometry. Up to twelve independently named scenes are retained per executed cell; the renderer activates scenes as needed and releases inactive GPU contexts. Structure requests open existing, source-qualified molecular context rather than inferring a protein model.

Scatter specifications carry exact values, explicit axes, classification and source metadata. Display coordinates are normalized independently; Euclidean scene distance has no biological interpretation. Membership overlays require exact Ensembl identifiers. Duplicate identifiers, unsupported relations and nonfinite scene coordinates are rejected. Archived expression does not measure protein abundance, conformation or activity.

Molecular systems is available through the scientific search commands and the R Studio’s More menu. It offers archived functional/complex memberships, typed gene–pathway–complex layers, selected-gene networks and illustrative neuron navigation. Neuron landmarks contain no inferred gene localization. Day views share a fixed archived colour domain.

## Saving and reconstruction

Notebooks save on the current device. Restoring them never executes code. Export provides notebook JSON, HTML, nonexecuting Quarto/R Markdown sources, R code and supported current-run artifacts. The Reports workspace exports a checksummed research-session ZIP containing recorded notebooks, exact available input CSVs, scenes, selections, projects and native replay scripts. Session import verifies the archive before requesting replacement of local research material.

Replay is explicit: inspect the exported scripts, then run them in the supplied replay directories. Recorded input hashes identify required bytes. Runs with unavailable historical inputs are marked nonreconstructable and their generated scripts fail explicitly. Native package environments, external resources or arbitrary user-created files may require additional dependencies. The archive is not a validated RO-Crate.

Scientific scenes export exact JSON/CSV, camera settings and a labelled PNG. Notebook document exports retain scene definitions; they do not embed an interactive WebGL application. The immutable scientific archive is [Zenodo v1.2.0](https://doi.org/10.5281/zenodo.23283595).

## Analyses and variables

My analyses contains editable local notebooks; each has a context menu for renaming and deletion, including the last notebook (a blank notebook is retained). Archived analyses shows all six supplied scripts. Opening one creates an editable copy without execution; the original remains available. These scripts reconstruct summaries and figures from frozen estimates, not the original raw-count DESeq2/enrichment fits. The editable-prior Bayesian analysis is exploratory.

The variable inspector separates working copies of archived inputs from user objects. Data frames have a 50-row paginated viewer, first-100-column disclosure, dimensions, column types, missing counts and finite numeric summaries. Object CSV export, Observable preview and Python transfer are limited to 2 MB. The quantitative 3D builder inserts editable R code; it does not run automatically. Full arbitrary interaction networks, molecular overlays and anatomical geometry are not supplied by that builder.

The global Selection menu provides inspection, transfer to R, collection entry, undo/redo and selection export. Search remains in the application header and Ctrl/Meta+K. Session exports retain notebooks, recorded outputs, exact available inputs and provenance; a selection export alone does not include notebook outputs.
