# Schmidt original-model reproduction

Completed 2026-09-18, separately from primary inference. Rebuilt all 43 libraries directly from TSV raw counts and refitted the published `~Batch + Cell_line + Condition_simple` model, retaining genes with any nonzero count. This validates input parsing and contrast coding; it does not endorse treating nested technical samples as independent biological replicates.

The cached object was fitted using DESeq2 1.40.2 (its metadata and rendered HTML session agree); the new fit uses DESeq2 1.52.0 under R 4.6.1. The article's methods version range is less specific than the executable record.

| Contrast (numerator minus denominator) | Cached DEG FDR <.05 | Refit DEG | Shared DEG | Cached up / down |
|---|---:|---:|---:|---:|
| Day 1 – Ctrl | 8,347 | 8,347 | 8,347 | 4,779 / 3,568 |
| Day 3 – Ctrl | 1,481 | 1,481 | 1,481 | 707 / 774 |
| Day 3 – Day 1 | 2,502 | 2,502 | 2,502 | 897 / 1,605 |

All fold-change signs agree. Across contrasts, median absolute log2-fold-change difference is <1.3×10⁻¹³ and maximum difference <2×10⁻⁶. This comparison uses the same alpha .05 and default DESeq2 filtering/Cook's behavior as source calls. Full cached and refitted gene tables, seven prespecified representative plasticity genes and agreement metrics are retained under `tables/reproduction/`. `tables/reproduction/count_identity.txt` records exact input equality. There is no unexplained material estimate discrepancy.

## Published enrichment audit and limits of reproduction

Original Figure 3 code performs over-representation tests on significant genes with clusterProfiler and selects neuroplasticity-related terms for display. Day-1 displayed GO candidates include axonogenesis, synapse organization, growth cone, synaptic vesicle and postsynaptic density; KEGG candidates are Neurotrophin signaling, Axon guidance and Synaptic vesicle cycle. Day-3 selected terms are a smaller overlapping GO list and Synaptic vesicle cycle. Source scripts use org.Hs.eg.db 3.17.0 / GO.db 3.17.0 in the rendered environment. Day-3 GO uses relaxed p/q cutoffs compared with Day 1, which further limits informal comparison of plotted bars.

The archived HTML preserves published figures and exact source selections, but no reusable numeric GO/KEGG result objects are deposited. Exact historical GO/KEGG p-values have **not** been numerically reproduced here: that would require the original annotation mappings and the contemporaneous live KEGG response. No current-database recreation is mislabeled as an exact reproduction. The complete DE result reproduction is the pipeline validation gate for the new ranked analysis; historical GO/KEGG reproduction remains bounded to method/term/figure verification. New Hallmark/Reactome tests use separately pinned memberships and are not substitutes for historical GO/KEGG outputs.

Source supplementary code already compares Day 3 with Day 1. The contribution under test is prespecified metabolic/redox ranking with biological-block and quality robustness, not invention of a temporal contrast. Reproducing the source's larger Day-1 DEG count is not itself evidence for metabolism, ROS, mitochondrial activity or a drug-specific time interaction.
