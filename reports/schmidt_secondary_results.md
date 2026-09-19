# Frozen secondary results

These seven sets were already executed by the frozen script alongside primary tests; they were not newly selected in this reporting turn. BH spans 21 tests, with untestable entries counted as p=1. The glutathione synthesis/recycling set contains 12 members before mapping and cannot reach the frozen minimum size 15: its q=1 is bookkeeping, not evidence for a null biological effect. No NADPH or synaptic-energetics set was frozen in this tier; new targeted tests are explicitly separate.

| pathway | contrast | NES | pval | family_fdr | robustness | test_status |
|---|---|---|---|---|---|---|
| REACTOME_RESPIRATORY_ELECTRON_TRANSPORT | day1_vs_control | 2.3022 | 1.3222e-11 | 1.3883e-10 | robust | tested |
| REACTOME_AUTOPHAGY | day1_vs_control | 1.6013 | 0.00086563 | 0.0025969 | robust | tested |
| REACTOME_MITOPHAGY | day1_vs_control | 1.5434 | 0.022604 | 0.043152 | robust | tested |
| REACTOME_ATF4_ACTIVATES_GENES_IN_RESPONSE_TO_ENDOPLASMIC_RETICULUM_STRESS | day1_vs_control | -1.1642 | 0.23348 | 0.35022 | unsupported | tested |
| REACTOME_SIGNALING_BY_NTRK2_TRKB | day1_vs_control | 0.8042 | 0.74962 | 0.926 | unsupported | tested |
| HALLMARK_FATTY_ACID_METABOLISM | day1_vs_control | 1.7605 | 5.9735e-05 | 0.00031361 | robust | tested |
| REACTOME_GLUTATHIONE_SYNTHESIS_AND_RECYCLING | day1_vs_control | NA | NA | 1 | unsupported | untestable under frozen minSize=15 |
| REACTOME_RESPIRATORY_ELECTRON_TRANSPORT | day3_vs_control | 2.4494 | 2.1574e-14 | 4.5305e-13 | robust | tested |
| REACTOME_AUTOPHAGY | day3_vs_control | 2.0065 | 2.595e-07 | 1.8165e-06 | robust | tested |
| REACTOME_MITOPHAGY | day3_vs_control | 1.8853 | 0.00076965 | 0.0025969 | robust | tested |
| REACTOME_ATF4_ACTIVATES_GENES_IN_RESPONSE_TO_ENDOPLASMIC_RETICULUM_STRESS | day3_vs_control | -1.7795 | 0.00706 | 0.016473 | robust | tested |
| REACTOME_SIGNALING_BY_NTRK2_TRKB | day3_vs_control | 1.7102 | 0.0083459 | 0.017526 | robust | tested |
| HALLMARK_FATTY_ACID_METABOLISM | day3_vs_control | 1.7461 | 8.1228e-05 | 0.00034116 | block-dependent | tested |
| REACTOME_GLUTATHIONE_SYNTHESIS_AND_RECYCLING | day3_vs_control | NA | NA | 1 | unsupported | untestable under frozen minSize=15 |
| REACTOME_RESPIRATORY_ELECTRON_TRANSPORT | day3_vs_day1 | -1.521 | 0.0047549 | 0.012482 | block-dependent | tested |
| REACTOME_AUTOPHAGY | day3_vs_day1 | 0.94558 | 0.59361 | 0.82137 | unsupported | tested |
| REACTOME_MITOPHAGY | day3_vs_day1 | -0.5898 | 0.98166 | 1 | unsupported | tested |
| REACTOME_ATF4_ACTIVATES_GENES_IN_RESPONSE_TO_ENDOPLASMIC_RETICULUM_STRESS | day3_vs_day1 | -0.88708 | 0.6258 | 0.82137 | unsupported | tested |
| REACTOME_SIGNALING_BY_NTRK2_TRKB | day3_vs_day1 | 1.2706 | 0.15763 | 0.25463 | unsupported | tested |
| HALLMARK_FATTY_ACID_METABOLISM | day3_vs_day1 | -1.3744 | 0.024822 | 0.043439 | block-dependent | tested |
| REACTOME_GLUTATHIONE_SYNTHESIS_AND_RECYCLING | day3_vs_day1 | NA | NA | 1 | unsupported | untestable under frozen minSize=15 |

Exploratory DNA repair and telomere-maintenance results remain in the full archive; neither measures telomere length, damage or protection and neither enters the central claim.
