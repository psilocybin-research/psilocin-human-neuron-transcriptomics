# Schmidt control resolution

Decision B, 2026-09-18: use a three-condition common-reference analysis. The public RNA files do not identify a control harvest day for each control library. Do not fit a treatment-by-time interaction, allocate controls to days by filename order, or interpret the treated Day-3-minus-Day-1 contrast as drug-specific temporal change.

## Evidence examined

- Excel metadata, all 43 count filenames and cached `001_dds.rds` colData: identities agree; `timepoint_d` is missing for all 43 libraries. Treated day labels are explicit in condition text. All eight controls enter one `Ctrl` factor.
- All three Rmd scripts and rendered HTML: preparation uses `~Batch + Cell_line + Condition_simple`; manually assigned plot labels contain eight controls, seven Day-1 and eight Day-3 psilocin libraries. No script creates time-specific control groups. The supplementary script already tests `Trt3` against `Trt5`.
- Cached TPM object is derived from the same count-file list; it adds no harvest-time mapping. The fitted object preserves the same metadata and model, rather than hidden control-time factors.
- GitHub's three-commit history, initial tree, publication-linked archive revision `418d5be061b9685b92704615703da3592aec9d05`, and every Software Heritage directory under `swh:1:dir:c847a8a51074c59d651e3258cf1355936e921048`: analysis blobs are unchanged since the initial commit. Software Heritage file hashes exactly match the archived GitHub tree. The subsequent changes add LICENSE and README only. See `metadata/schmidt_archive_comparison.csv`.
- Article, reviewer exchange, MDAR and Dryad metadata/embedded README: authors describe vehicle controls at matching time points, including a 24-hour control clarification. That statement supports intended matching but does not map the RNA control libraries to distinct days. Some figure captions still use pre-treatment wording; this discrepancy cannot be repaired by inventing sample labels.
- Dryad version 434510 lists Figure 2, 4 and 5 phenotype archives and README, with no RNA metadata archive. README definitions are visible in the public landing page. File-stream access remains HTTP 403; archive contents beyond the listed files have not been inspected.
- Accession-pattern search of article XML/JSON, Dryad metadata/README and Rmd files finds no GSE/GSM/PRJNA/SRP/ERP/E-MTAB accession (machine-readable search output retained). Public web searches for Schmidt/psilocin in GEO and EBI did not locate a matching sequencing deposition. This is a bounded negative search, not proof that none exists.

`metadata/schmidt_control_resolution.csv` records every library, source technical label, line, batch, treatment, recovered treated day, control relationship, evidence and separate confidence judgments. Metadata identity and coded comparisons are confirmed; applying MDAR's differentiation definition to RNA Batch is strongly inferred; control-day allocation and exact well/RNA/run subdivisions remain unresolved.

## Experimental unit and aggregation

MDAR distinguishes independent differentiations from multiple samples from one differentiation. The conservative working unit is therefore line × differentiation batch: three blocks from two genetic backgrounds. Sum raw counts within each of nine block–condition groups; do not model the 23 libraries as independent biological replicates. This is conservative aggregation of nested culture samples, **not a verified merge of repeated sequencing runs from one RNA extraction**. Exact nesting below differentiation remains unknown. Retain unpooled QC and prespecify a one-library-per-group sensitivity and leave-one-block-out analyses. Unequal technical sample counts affect precision and averaging; they do not increase independent N.

## Estimands allowed

1. Day-1 psilocin versus the supplied common Ctrl group, adjusted for block.
2. Day-3 psilocin versus the same Ctrl group, adjusted for block.
3. Day-3 versus Day-1 among psilocin-treated samples, adjusted for block.

These are condition-associated contrasts. Contrast 3 combines treatment-associated evolution with any ordinary culture-time effects. No per-day vehicle subtraction or difference-in-differences is identifiable. Neither a favorable enrichment result nor strong reproducibility can resolve this missing design information.

Primary sources: [article and reviews](https://elifesciences.org/articles/104006), [author repository](https://github.com/ahoffrichter/Schmidt_et_al_2025), [Software Heritage directory](https://archive.softwareheritage.org/api/1/directory/c847a8a51074c59d651e3258cf1355936e921048/), [Dryad](https://doi.org/10.5061/dryad.xsj3tx9w3). Rebuild: `python -m src.audit.control_resolution` after acquiring reference inputs and extracting RDS colData.
