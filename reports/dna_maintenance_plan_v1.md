# Bounded DNA-maintenance follow-up, v1

Status: post hoc, hypothesis-generating; locally specified before the new sensitivities below. This is not an external preregistration or an outcome-blind plan. The original frozen exploratory family (DNA repair and telomere maintenance, three contrasts, six tests) remains unchanged.

## Prior knowledge

The original pathway results, including positive enrichment at both sampled days, and the user's detailed reviews were available before this plan. These reviews disclosed telomere leading-edge sizes 27/25, 22 shared/30 union, specific shelterin/RNP/polymerase genes, DNA-repair overlaps 13/11, and absent or mixed canonical telomere factors. These claims will be verified, not treated as new prospective predictions. Existing OXPHOS, redox and all broad frozen results were also known. No results for the newly defined sets below were inspected before this record.

## Fixed scope and estimands

Use the existing unshrunken Wald ranks and descriptive within-block log-ratio ranks, the original symbol representative map, literal symbols and the same ten variants (primary, three omissions, three RNA-quality/technical fits, three individual blocks). No refitting, new exclusions or alias rescue. All three original contrasts are retained; the treated-day contrast is not a treatment-by-time interaction.

Eight sets are enumerated with exact memberships in `config/dna_maintenance_v1.json`: each parent minus the entire other parent, each parent minus the union of the frozen OXPHOS and ROS sets, and four contextual sets (Hallmark E2F targets, G2M checkpoint, mitotic spindle, Reactome DNA replication). One new 24-test BH family per fitted variant covers all eight sets and all three contrasts. Missing/untestable tests remain in the denominator with p=1 for adjustment only. Single-block enrichment is descriptive with no q-value. Use fgseaMultilevel with minSize 15, maxSize 500, eps 0, nPermSimple 10000, sampleSize 101, gseaParam 1, standard two-sided score, one worker and seed 104006 reset per test. Preserve warning logs and mapping coverage. Apply the original directional robustness rule, requiring primary q<0.05 and concordant finite directions in all nine sensitivity variants. Small competitive gene-ranking p-values do not quantify biological-block uncertainty.

Set subtraction removes full source memberships before intersecting each rank universe. Retained positive enrichment supports resistance to that particular overlap removal; it cannot establish biological independence or mechanistic specificity. Untestable reduced sets will be reported as such. Positive cell-cycle controls preclude a repair-specific interpretation; negative controls cannot prove specificity.

## Descriptive characterization (no new p-values)

Quantify parent and leading-edge overlap (intersection/union, Jaccard, fraction of each set), separately by day and for the leading-edge unions. Annotate all telomere leading-edge union genes against descendant pathways in the pinned MSigDB GMT. Verify hierarchy/stable identifiers using a timestamped Reactome API snapshot; this annotation snapshot is distinct from the frozen gene-set release. Preserve multiple memberships, report unmatched genes explicitly, and do not force disjoint categories. Display packing/protection, telomerase extension/RNP, C-strand synthesis, recombination/chromatin, and any verified RNA/TERRA components only where memberships support them. No enrichment tests of these subgroups.

For the union of DNA-repair and telomere leading edges at either sampled day, report Day-1/Day-3 log2FC and Wald-statistic Spearman concordance and same-sign fractions without p-values, plus the two parent unions separately. These are selected-gene descriptive summaries sharing controls, not independent validation or persistence estimates. Extract the prelisted canonical panel from existing gene-level tables using the frozen selected-symbol map; original transcriptome-wide gene FDR only. Explicitly report missing symbols/aliases, and do not equate absence with a null.

## Stopping rule and reporting

Complete decomposition, four overlap-removal sensitivities, four cell-cycle controls and descriptive cross-day concordance; then stop. No broad GO search, extra repair subfamily testing, TF/network analysis or ML. Report every result and contradiction. Keep this follow-up subordinate in the current manuscript and in a separately labeled DNA-maintenance atlas view. Transcriptional enrichment does not measure DNA repair activity, DNA damage, proliferation, telomerase activity or telomere preservation.
