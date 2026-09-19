# Schmidt RNA-seq technical QC

Frozen before primary enrichment, 2026-09-18. All 23 core libraries retained. QC does not establish absence of confounding.

## Inputs, independent units and checks

All 43 count files have the same 57,820 unique gene IDs and valid nonnegative integer raw counts. Count values and sample order independently reconstructed from source TSVs agree exactly with the author's cached object for its 46,006 nonzero genes. The core subset has 23 libraries and nine summed block–condition profiles from three differentiation blocks and two genetic backgrounds. Pooling conserves counts and never crosses a block or condition.

`src/transcriptomics/qc_reproduce.R` generates metrics, Pearson/Spearman matrices, VST Euclidean distances, top-500-variable-gene PCA and raw/normalized expression distributions for all 43 libraries, the 23 core libraries and nine pooled profiles. VST is blind to experimental design; normalization is DESeq2 median ratio. Tables are in `tables/qc/`; PDF diagnostics and PNG PCA previews are in `figures/qc/`. Source IDs are preserved; no genotype-level sample authentication is possible from these gene count tables.

## Observations

- Core library assigned-gene counts range 10.85–19.31 million, with 25,963–29,487 detected genes. These are assigned gene counts, not total sequencing read pairs. Size factors range 0.771–1.441.
- Within-group VST Pearson correlations range 0.9603–0.9931 (20 pairs). High correlations do not prove technical equivalence or independence.
- Core PCA PC1 explains 77.80% of selected-gene variance and separates genetic backgrounds. PC2 explains 15.53%. Day-1 samples `trt511-4` (RIN 5.2) and `trt512-4` (RIN 5.0) have the largest PC2 scores; both belong to line 69_2/batch 1 and have source QC resubmission notes. Their different position is a technical-quality concern, not evidence of the target biological response.
- Review flags are descriptive: absolute log10-library-size deviation >3 scaled MADs, <1 million assigned counts, or <10,000 detected genes. `ctrl3-2` flags for relatively high depth. Pooled `68_3__batch2__psilocin_day1` flags for relatively low total depth (15.81 million), explained by one source library versus two or three in other groups. Neither fails an absolute depth/complexity threshold. These flags were selected for QC inspection before pathway outcomes, not as automatic exclusion rules.
- All primary source RIN values meet the author's RIN ≥5 criterion. Missing control harvest labels remain a design issue that QC cannot fix. Counts cannot assess mapping rates, contamination, gene-body coverage or RNA degradation profiles; no BAM/FASTQ data are supplied.

## Fixed decisions before testing

Retain all core libraries and all three blocks in the primary analysis. Do not remove samples for PCA separation, dispersion, Cook's distance or pathway strength. Use DESeq2's gene-level Cook's masking in primary ranked inference, with independent filtering disabled for ranking; report unavailable statistics. Minimum count filter is fixed in the analysis plan.

Sensitivity analyses: (1) omit each differentiation block; (2) add centered group-mean RIN to the pooled model if full rank; (3) exclude individual libraries with RIN <6, re-pool all groups and verify each group remains represented; (4) select the lexicographically first source library per group, treating each resulting observation as its block–condition representative. Rule 3 explicitly responds to known QC information and is not an independently preregistered threshold. Rule 4 probes aggregation dependence but cannot fully characterize every possible nested-culture weighting. In addition, report each block's normalized within-block expression direction without treating genes or technical samples as biological replicates. Interpretation must acknowledge only two genetic backgrounds; the single-block background cannot sustain a separate DESeq2 inferential fit.

No target pathway result was inspected before these decisions. The source reproduction results and public paper were already known; the study is not outcome-blind or externally preregistered.
