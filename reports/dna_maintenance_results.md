# DNA-maintenance follow-up results

## Status and scope

The original six-test exploratory family is distinct from this post hoc, 24-test follow-up. The follow-up was locally hash-frozen at the time in `provenance/dna_maintenance_freeze_v1.json`, before its new enrichment outputs, after parent results and specific gene findings were known. It is not an external preregistration. All 24 primary-model tests and all 240 variant results are retained; the original primary analysis was not changed.

## Interpretation

The originally frozen DNA-repair and telomere sets are positively enriched and directionally robust at both sampled days. Both treated-day comparisons are block-dependent. This is exploratory evidence from existing RNA-seq, not new experimental evidence of repair or telomere protection.

Removing the entire telomere membership leaves DNA repair robust at both days (NES 2.014/2.008, new-family q approximately 5.51e-6 each). Removing the entire DNA-repair membership leaves 37 ranked telomere genes: positive at both days, robust at Day 1 (NES 1.546, q=0.0430), but below the support threshold at Day 3 (NES 1.395, q=0.111). Day-3 sensitivity directions agree, but this does not make its new-family q significant. This weakens a claim that the original telomere result is wholly distinct from broader DNA-maintenance transcription.

Removing OXPHOS/ROS membership leaves both parent sets robust and positive at both days. Only one source telomere member and five DNA-repair members are removed by that operation; it is therefore a limited overlap check, not evidence of mechanistic independence.

Reactome DNA replication is positively enriched at both days (NES 1.850/1.856, q=9.65e-5/5.44e-5), robust at Day 1 and block-dependent at Day 3. E2F targets, G2M checkpoint and mitotic spindle do not pass the 24-test threshold at either day. These mixed controls neither establish proliferation nor isolate a repair-specific mechanism. No new treated-time set is robust.

## Composition, overlap and concordance

The telomere leading edges contain 27 and 25 genes, 22 shared, 30 in their union. Three union genes (ACD, TERF2, TINF2) are annotated to packaging/protection. The same union also includes C-strand synthesis, telomerase/RNP-related components and RNA polymerase II genes in the recombination/TERRA branch. Memberships overlap and are not disjoint functional modules; branch or reaction membership is not an activity assay. The entire source sets overlap by 25 genes (150 DNA repair; 112 telomere; Jaccard 0.105). Their leading edges overlap by 13/27 telomere genes at Day 1 and 11/25 at Day 3. Rank mapping retains 62 of the 112 source telomere symbols: substantial literal-symbol/retention losses must remain visible, not silently repaired.

The telomere union has 29/30 genes positive at both days, with descriptive log2FC Spearman rho 0.791. The combined DNA-repair/telomere union has 84/88 positive at both days, rho 0.769 (Wald-statistic rho 0.680). Shared controls and leading-edge selection inflate apparent agreement; these summaries are not independent validation or a formal persistence test. The canonical panel retains absent and mixed results, including absent TERT and negative POT1 at both days. Source-symbol checks H2AX/H2AFX are explicit and do not double-count a biological gene.

## Annotation evidence

Gene memberships for available child pathways come from the original MSigDB 2026.1.Hs GMT. Reactome release 97 provides a separately timestamped hierarchy/stable-ID snapshot and descriptive reaction annotations. Packaging of telomere ends and flap removal are absent as individual sets from this GMT. Packaging/protection is therefore explicitly annotated from Reactome 97 participants; flap removal is retained in the hierarchy with membership unavailable and is not assigned from invented data. TERRA and RNP reaction annotations include associated-complex participants; they do not identify telomere-specific expression effects. Reactome identifiers, mapping coverage, complete row annotations and all overlapping assignments are downloadable. No descendant-set enrichment was tested.

## Frozen exploratory results

| Pathway | Contrast | NES | 6-test q | Direction class |
| --- | --- | --- | --- | --- |
| HALLMARK_DNA_REPAIR | day1_vs_control | 2.137 | 2.235e-08 | robust |
| REACTOME_TELOMERE_MAINTENANCE | day1_vs_control | 1.856 | 0.0006153 | robust |
| HALLMARK_DNA_REPAIR | day3_vs_control | 2.1 | 3.677e-08 | robust |
| REACTOME_TELOMERE_MAINTENANCE | day3_vs_control | 1.702 | 0.00319 | robust |
| HALLMARK_DNA_REPAIR | day3_vs_day1 | -1.768 | 0.0001059 | block-dependent |
| REACTOME_TELOMERE_MAINTENANCE | day3_vs_day1 | -1.391 | 0.04756 | block-dependent |

## All post hoc results

| Set | Contrast | Mapped | NES | 24-test q | Direction class |
| --- | --- | --- | --- | --- | --- |
| TELOMERE_MINUS_DNA_REPAIR | day1_vs_control | 37 | 1.546 | 0.04304 | robust |
| DNA_REPAIR_MINUS_TELOMERE | day1_vs_control | 118 | 2.014 | 5.512e-06 | robust |
| TELOMERE_MINUS_OXPHOS_ROS | day1_vs_control | 61 | 1.809 | 0.001428 | robust |
| DNA_REPAIR_MINUS_OXPHOS_ROS | day1_vs_control | 138 | 2.038 | 2.191e-06 | robust |
| HALLMARK_E2F_TARGETS | day1_vs_control | 179 | 1.126 | 0.3179 | directionally consistent but uncertain |
| HALLMARK_G2M_CHECKPOINT | day1_vs_control | 177 | 0.9312 | 0.7539 | unsupported |
| REACTOME_DNA_REPLICATION | day1_vs_control | 121 | 1.85 | 9.651e-05 | robust |
| HALLMARK_MITOTIC_SPINDLE | day1_vs_control | 193 | 1.013 | 0.5765 | directionally consistent but uncertain |
| TELOMERE_MINUS_DNA_REPAIR | day3_vs_control | 37 | 1.395 | 0.1115 | directionally consistent but uncertain |
| DNA_REPAIR_MINUS_TELOMERE | day3_vs_control | 118 | 2.008 | 5.512e-06 | robust |
| TELOMERE_MINUS_OXPHOS_ROS | day3_vs_control | 61 | 1.653 | 0.01201 | robust |
| DNA_REPAIR_MINUS_OXPHOS_ROS | day3_vs_control | 138 | 2.006 | 2.649e-06 | robust |
| HALLMARK_E2F_TARGETS | day3_vs_control | 179 | 0.9766 | 0.6525 | unsupported |
| HALLMARK_G2M_CHECKPOINT | day3_vs_control | 177 | 0.885 | 0.7714 | unsupported |
| REACTOME_DNA_REPLICATION | day3_vs_control | 121 | 1.856 | 5.438e-05 | block-dependent |
| HALLMARK_MITOTIC_SPINDLE | day3_vs_control | 193 | 1.216 | 0.1633 | unsupported |
| TELOMERE_MINUS_DNA_REPAIR | day3_vs_day1 | 37 | -0.8726 | 0.7618 | unsupported |
| DNA_REPAIR_MINUS_TELOMERE | day3_vs_day1 | 118 | -1.652 | 0.002936 | block-dependent |
| TELOMERE_MINUS_OXPHOS_ROS | day3_vs_day1 | 61 | -1.355 | 0.1115 | unsupported |
| DNA_REPAIR_MINUS_OXPHOS_ROS | day3_vs_day1 | 138 | -1.716 | 0.0004218 | block-dependent |
| HALLMARK_E2F_TARGETS | day3_vs_day1 | 179 | -1.087 | 0.376 | unsupported |
| HALLMARK_G2M_CHECKPOINT | day3_vs_day1 | 177 | -0.8813 | 0.7714 | unsupported |
| REACTOME_DNA_REPLICATION | day3_vs_day1 | 121 | -1.509 | 0.01275 | block-dependent |
| HALLMARK_MITOTIC_SPINDLE | day3_vs_day1 | 193 | 0.9017 | 0.7714 | unsupported |

## Reproduction and stopping rule

`Rscript src/transcriptomics/dna_maintenance.R` verifies the original and follow-up freezes and uses saved ranks. `python -m src.transcriptomics.report_dna_maintenance` verifies the follow-up inputs and regenerates descriptive tables. `src/acquisition/reactome_dna_annotation.py` and `reactome_dna_reactions.py` acquire or verify annotation snapshots. Source provenance and licenses are in `metadata/reactome_dna_*.json`. Full memberships are in the local plan/config, warnings and software versions in provenance, and complete results in `tables/dna_maintenance/`.

The bounded stopping rule has been reached. No further same-dataset pathway expansion is needed. The results belong in this manuscript's exploratory context; independent data or direct functional measurements would be needed for stronger DNA-maintenance or telomere claims.
