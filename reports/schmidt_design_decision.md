# Schmidt RNA-seq design decision

2026-09-18. Status: source-backed structural decision and prepared counts; **no differential-expression or enrichment model fitted**.

## Experimental units

The downloaded [MDAR checklist](https://cdn.elifesciences.org/articles/104006/elife-104006-mdarchecklist1-v1.docx) defines technical replication as multiple samples from one differentiation of a cell line, and biological replication as independent differentiations initiated from independent iPSC passages. The Dryad description uses the same differentiation-based definition of batch.

Applying that definition conservatively to the RNA metadata's `Cell_line` and `Batch` fields yields three line–batch blocks: `68_3/1`, `68_3/2`, `69_2/1`. The exact identity of every culture/well and the T1/T2 split are not separately documented, so this grouping intentionally avoids treating either suffixed or unsuffixed libraries within a block/condition as extra biological replication. This is a source-supported working interpretation of `Batch`, not an independently verified culture lineage reconstruction.

Primary conditions are the source `Ctrl`, `Trt5` and `Trt3` labels. Concentration and duration columns confirm 10 µM for 10 minutes in the treated groups; condition text and the [published analysis scripts](https://github.com/ahoffrichter/Schmidt_et_al_2025/tree/c565709affafbea09406bd7b42fe494f08db6cce/r-scripts) identify Trt5 as Day 1 and Trt3 as Day 3. Ketanserin/PLG conditions are retained in raw data but excluded from this core comparison.

| Line/batch | Control libraries | Day-1 libraries | Day-3 libraries |
|---|---:|---:|---:|
| 68_3 / 1 | 3 | 3 | 3 |
| 68_3 / 2 | 2 | 1 | 2 |
| 69_2 / 1 | 3 | 3 | 3 |
| Total | 8 | 7 | 8 |

The primary subset is **23 libraries, three differentiation blocks, two genetic backgrounds**. Summing raw counts within each line × batch × condition creates nine condition-level profiles, not nine independent donors. Each block contributes all three conditions, so a proposed `~ block + condition` design has rank five and nominal residual df four. This verifies algebraic estimability, not adequate power or model assumptions. Equal contribution of genetic backgrounds is not automatic: one line contributes two blocks and the other one block.

The prepared matrix has 57,820 genes. Raw counts and source files remain unchanged. `metadata/schmidt_core_samples.csv` maps every library to a pooled unit; `schmidt_core_exclusions.csv` documents the 20 other libraries; `schmidt_analysis_units.csv` records membership and RIN; `schmidt_counts_transformation.json` records input/output hashes. Pooling is a conservative analysis choice, not a claim that separate culture samples are sequencing runs of the identical RNA extraction.

## What the temporal contrasts mean

The RNA workbook's `timepoint_d` is empty for every sample. Treated days can be assigned from condition text and source contrasts; **control harvest days cannot**.

The article's author response describes a vehicle control collected 24 hours after treatment and elsewhere mentions matched-time controls. This helps explain the study but does not identify separate Day-1/Day-3 control libraries in the RNA workbook. The code uses a single `Ctrl` group in both contrasts. Do not manufacture separate controls by duplicating those libraries under two day labels.

| Contrast | Identifiable description | Unsupported stronger interpretation |
|---|---|---|
| Trt5 − Ctrl | Day-1 treated condition versus available reference controls, accounting for block | Verified Day-1 treatment effect until control timing is reconciled |
| Trt3 − Ctrl | Day-3 treated condition versus the same available reference controls | Verified Day-3 treatment effect against Day-3 controls |
| Trt3 − Trt5 | Difference between two sampled treated states | Drug-specific treatment × time interaction independent of culture ageing |

Subtracting the two shared-control contrasts cancels the control term. It supplies the treated Day-3-versus-Day-1 comparison, not the missing untreated temporal trajectory. Strong conclusions about a drug-specific evolving program remain limited by this design. The plan must choose explicitly between condition-associated inference under this limitation and a stronger time-matched treatment claim; only the former is currently reconstructable.

## Quality and sensitivity decisions still needed before a freeze

RIN differs across conditions, especially `69_2/1` Day 1 (5.0–6.7), which includes resubmission notes. Its controls span 7.0–8.7 and Day-3 samples 7.7–8.7. Retain the original values and specify quality sensitivity before viewing pathway results.

Candidate sensitivity checks include omission of each block, a prespecified representative-library analysis to assess pooling dependence, and descriptive within-block effect directions. Dropping either `68_3` block retains both backgrounds; dropping `69_2/1` leaves one background. Dropping all of `68_3` leaves only one differentiation block: population-level differential-expression inference would be unsupported. Report this asymmetry rather than advertise a symmetric leave-one-donor-out validation.

Pooling weights technical libraries by their reads. An expression-normalized, equal-library-weighted descriptive check may help detect dependence on that weighting but must not be substituted into a raw-count model. A mean RIN across libraries is a descriptive summary, not a measured RIN for the pooled profile.

## Novelty consequence

The original supplementary script already computes `Trt3` versus `Trt5`. The added contribution is a prespecified, whole-transcriptome ranked metabolic/redox analysis, with interpretable leading genes, appropriate biological-unit handling and sensitivity assessment. Repeating the temporal contrast alone is not novel. Broad original GO/KEGG testing also means we must not claim metabolic pathways were never tested merely because their terms were not highlighted.

## Current decision

Proceed with source reconciliation, technical QC and specification of a **bounded condition-associated transcriptomic analysis**. A treated-time comparison is available; a treatment-by-time interaction is not reconstructable from the current metadata. No human input is needed for this decision. Do not describe the prepared matrix as an observed metabolic signature or freeze an overstrong temporal estimand.
