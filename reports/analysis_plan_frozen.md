# Frozen transcriptomic analysis plan v1.0

Frozen 2026-09-18, before any primary metabolic/redox differential-expression or enrichment result. This is a local, dated specification, not an externally registered preregistration. The question is whether the public Schmidt dataset supports a coherent metabolic/redox signature and treated temporal structure that survives conservative handling of biological replication and RNA quality. A positive result is not required.

Prior exposure: the public article, all source scripts/rendered analyses, cached original fitted object, original-model reproduction and technical QC have been inspected. The original model's Day-1 response is larger than Day 3; low-RIN Day-1 samples separate on PC2. These are disclosed inputs to the design, not new primary-pathway findings.

## Fixed design and estimands

Follow decision B in `schmidt_control_resolution.md`. Analyze nine summed block–condition profiles representing 23 source libraries, three differentiation blocks and two genetic backgrounds. Raw-count aggregation is a conservative treatment of nested culture samples, not a proven merge of sequencing runs from one extraction. No additional library is excluded from the primary model. Twenty co-treatment/PLG libraries are outside its question but remain in source reproduction.

Fit DESeq2 1.52.0 under R 4.6.1 with `~block + condition`, control as reference, default median-ratio normalization and parametric dispersion fit. Disable automatic count replacement; retain default gene-level Cook's masking. The design has rank 5 and 4 residual degrees of freedom. Keep genes with at least 10 counts in at least 3 of the 9 profiles; fix this gene universe for sensitivity fits. Gene-level BH-adjusted values are reported but no DEG threshold selects enrichment genes.

Three contrasts, numerator minus denominator: Day 1 versus common Ctrl; Day 3 versus common Ctrl; treated Day 3 versus treated Day 1. Control-day assignment is unresolved, so no drug-specific treatment-by-time interaction is identifiable. Comparing two NES estimates or their significance statuses is not a temporal test.

## Memberships, ranking and multiplicity

`config/gene_sets.yaml` contains exact sorted memberships, membership SHA-256, release and source-file SHA-256 for MSigDB Human 2026.1.Hs. Primary sets are HALLMARK_OXIDATIVE_PHOSPHORYLATION, HALLMARK_GLYCOLYSIS, HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY, HALLMARK_MTORC1_SIGNALING and HALLMARK_PI3K_AKT_MTOR_SIGNALING. Secondary sets are the seven explicitly listed respiration, glutathione, autophagy, mitophagy, ATF4 stress, NTRK2 and fatty-acid sets. DNA repair and telomere maintenance are two exploratory sets; they cannot substantiate telomere-length or protection claims.

Use the source featureCounts gene symbol; no undocumented alias rescue. For duplicate symbols select the gene with highest mean normalized expression across all primary profiles, tie-breaking lexically on gene ID. Fix that selection across sensitivities. Record lost, duplicated and retained mappings. Rank finite unshrunken Wald statistics with independent filtering disabled; descending statistic, lexical symbol for exact ties. Record ties and unavailable statistics.

Use fgseaMultilevel 1.38.0, standard weighted score (gseaParam 1), set sizes 15–500 after overlap, eps 0, sampleSize 101, nPermSimple 10,000, seed 104006 and one worker. Report NES, ES, nominal p, log2err, mapped size and full leading edge. BH correction spans all 15 primary tests jointly; the 21 secondary and 6 exploratory tests form separate declared families. Untestable sets remain visible and count as p=1 for family correction. Internal fgsea adjustment across all supplied sets is retained separately and never substituted for the declared correction.

## Robustness and scope of evidence

Run each of three leave-one-block-out fits, a pooled mean-RIN covariate fit, re-pooling after excluding libraries with RIN <6, and one lexically selected source library per group. Check rank and residual degrees of freedom each time. Do not silently replace an unestimable sensitivity; report it. Retain full outputs including loss of significance and reversals. Omission of line 69_2 leaves two blocks from 68_3, providing its estimable background-specific sensitivity. Line 69_2 alone has one block and supplies descriptive directions only.

For each block report normalized log2(count+1) contrasts, descriptive rank enrichment and primary-leading-edge mean direction. Equal-weight block means of whole-set log ratios receive exhaustive two-sided sign-flip summaries over eight sign assignments. With three blocks the smallest attainable two-sided p is .25; these summaries cannot establish conventional sample-level significance and rely on exchangeability/symmetry assumptions. Gene-randomization enrichment p-values do not preserve inter-gene correlation, so they are competitive gene-ranking evidence rather than independent-sample replication.

The exact four-category rule is in `config/analysis.yaml`. “Robust” requires primary family FDR <.05 and direction agreement across every per-block, omitted-block and technical/RIN sensitivity, with all estimable; small subsets are not required to pass significance thresholds. Primary-significant findings with a block-direction reversal are “block-dependent.” Other prespecified directional/technical uncertainty is “directionally consistent but uncertain”; lack of primary evidence plus inconsistent support is “unsupported.” Labels describe within-dataset stability only.

Coherence requires at least two robust anchors from distinct families: OXPHOS, glycolysis, ROS and growth signaling (the two mTOR-related anchors count as one family). Show membership/leading-edge overlap so redundant genes are not independent confirmations. A robust treated Day-3-versus-Day-1 anchor supports treated temporal structure; control-adjusted drug-specific evolution remains unidentified. Mixed pathway directions cannot be summarized as uniform metabolic activation. Transcription does not measure respiration, ATP, ROS concentration, kinase activity or pathway flux.

## Completion gates and audit trail

Control evidence resolved as bounded decision B; raw counts match the cached object exactly; QC decisions fixed; all original-model DEG sets reproduced; historical GO/KEGG numerical reproduction explicitly limited by missing historical annotation/results; Python and R invariant checks pass. `renv.lock`, Python lock, acquisition/restore commands and frozen-input hashes document the environment and inputs. Create an automated local Git commit/tag before running the primary script. No author identity or publication registration is implied by that checkpoint.

`provenance/analysis_freeze.json` lists exact hashes and UTC time. The analysis checks them before execution. Any later change affecting estimates must retain v1.0 and enter `reports/deviations.md` with reason and outcomes already seen. Generated full gene tables/model objects are reproducible outputs, not manually edited evidence.

Supporting cellular/human work follows `cross_scale_framework.md`: prioritize the 10-minute/10 µM series, respect assay times, keep extended exposures separate, and use human linkages only with documented identifiers. Supporting availability is not a gate for this primary analysis. No numerical human-cell pooling or causal chain is permitted.
