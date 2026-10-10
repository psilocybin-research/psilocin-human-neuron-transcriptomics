# Correlation-aware sensitivity results

Post hoc analysis, 10 October 2026. Plan and code were hash-frozen before outcome inspection; a documented export-only amendment preceded inspection. Original primary results remain unchanged. Nine profiles, three differentiation blocks, two backgrounds, 21,098 symbols, rank-five model and four residual degrees of freedom.

OXPHOS retained upward direction for both common-control comparisons. Estimated-correlation CAMERA supported none of the 15 tests at BH q<0.05. Fixed correlation 0.01 gave stronger evidence, including significant upward OXPHOS in both comparisons and a negative treated-day contrast. The latter does not override the original block-dependent temporal classification. These are different assumptions, not competing options from which to select a favorable result.

| Setting | Pathway | Contrast | Genes | Direction | Correlation | VIF | p | 15-test BH q |
|---|---|---|---:|---|---:|---:|---:|---:|
| estimated | OXIDATIVE PHOSPHORYLATION | day1_vs_control | 182 | Up | 0.31817 | 58.588 | 0.27401 | 0.58717 |
| estimated | GLYCOLYSIS | day1_vs_control | 184 | Up | 0.028467 | 6.2095 | 0.22399 | 0.58717 |
| estimated | REACTIVE OXYGEN SPECIES PATHWAY | day1_vs_control | 42 | Up | 0.2493 | 11.221 | 0.27065 | 0.58717 |
| estimated | MTORC1 SIGNALING | day1_vs_control | 189 | Up | 0.10969 | 21.623 | 0.64322 | 0.67029 |
| estimated | PI3K AKT MTOR SIGNALING | day1_vs_control | 96 | Up | 0.12547 | 12.919 | 0.41072 | 0.67029 |
| estimated | OXIDATIVE PHOSPHORYLATION | day3_vs_control | 182 | Up | 0.26627 | 49.194 | 0.23528 | 0.58717 |
| estimated | GLYCOLYSIS | day3_vs_control | 184 | Up | 0.022893 | 5.1894 | 0.33534 | 0.62877 |
| estimated | REACTIVE OXYGEN SPECIES PATHWAY | day3_vs_control | 42 | Up | 0.21249 | 9.712 | 0.17836 | 0.58717 |
| estimated | MTORC1 SIGNALING | day3_vs_control | 189 | Up | 0.06059 | 12.391 | 0.65473 | 0.67029 |
| estimated | PI3K AKT MTOR SIGNALING | day3_vs_control | 96 | Up | 0.071189 | 7.7629 | 0.20454 | 0.58717 |
| estimated | OXIDATIVE PHOSPHORYLATION | day3_vs_day1 | 182 | Down | 0.26488 | 48.944 | 0.48997 | 0.67029 |
| estimated | GLYCOLYSIS | day3_vs_day1 | 184 | Down | 0.021946 | 5.0161 | 0.22833 | 0.58717 |
| estimated | REACTIVE OXYGEN SPECIES PATHWAY | day3_vs_day1 | 42 | Down | 0.20533 | 9.4187 | 0.6543 | 0.67029 |
| estimated | MTORC1 SIGNALING | day3_vs_day1 | 189 | Down | 0.062754 | 12.798 | 0.60742 | 0.67029 |
| estimated | PI3K AKT MTOR SIGNALING | day3_vs_day1 | 96 | Down | 0.071933 | 7.8337 | 0.67029 | 0.67029 |
| fixed_0.01 | OXIDATIVE PHOSPHORYLATION | day1_vs_control | 182 | Up | 0.01 | 2.81 | 7.7907e-09 | 5.8431e-08 |
| fixed_0.01 | GLYCOLYSIS | day1_vs_control | 184 | Up | 0.01 | 2.83 | 0.033408 | 0.06264 |
| fixed_0.01 | REACTIVE OXYGEN SPECIES PATHWAY | day1_vs_control | 42 | Up | 0.01 | 1.41 | 0.00031817 | 0.0011931 |
| fixed_0.01 | MTORC1 SIGNALING | day1_vs_control | 189 | Up | 0.01 | 2.88 | 0.17113 | 0.23336 |
| fixed_0.01 | PI3K AKT MTOR SIGNALING | day1_vs_control | 96 | Up | 0.01 | 1.95 | 0.018299 | 0.039211 |
| fixed_0.01 | OXIDATIVE PHOSPHORYLATION | day3_vs_control | 182 | Up | 0.01 | 2.81 | 5.5752e-09 | 5.8431e-08 |
| fixed_0.01 | GLYCOLYSIS | day3_vs_control | 184 | Up | 0.01 | 2.83 | 0.13871 | 0.20807 |
| fixed_0.01 | REACTIVE OXYGEN SPECIES PATHWAY | day3_vs_control | 42 | Up | 0.01 | 1.41 | 1.9085e-05 | 9.5425e-05 |
| fixed_0.01 | MTORC1 SIGNALING | day3_vs_control | 189 | Up | 0.01 | 2.88 | 0.3176 | 0.34029 |
| fixed_0.01 | PI3K AKT MTOR SIGNALING | day3_vs_control | 96 | Up | 0.01 | 1.95 | 0.002543 | 0.0063574 |
| fixed_0.01 | OXIDATIVE PHOSPHORYLATION | day3_vs_day1 | 182 | Down | 0.01 | 2.81 | 0.0015572 | 0.0046715 |
| fixed_0.01 | GLYCOLYSIS | day3_vs_day1 | 184 | Down | 0.01 | 2.83 | 0.058678 | 0.097797 |
| fixed_0.01 | REACTIVE OXYGEN SPECIES PATHWAY | day3_vs_day1 | 42 | Down | 0.01 | 1.41 | 0.21213 | 0.26517 |
| fixed_0.01 | MTORC1 SIGNALING | day3_vs_day1 | 189 | Down | 0.01 | 2.88 | 0.24119 | 0.2783 |
| fixed_0.01 | PI3K AKT MTOR SIGNALING | day3_vs_day1 | 96 | Down | 0.01 | 1.95 | 0.35837 | 0.35837 |

CAMERA is competitive and model-dependent. Estimated correlations are imprecise with four residual degrees of freedom. Estimated versus fixed CAMERA also changes the reference degrees of freedom (4 versus 21,096 in limma 3.68.5), not just variance inflation. Correlations come from weighted residual coordinates after fitting block and condition. Test differences from fgsea additionally include precision modeling and statistics, not correlation alone. Common controls are not verified matched-age controls. No test establishes mitochondrial function, persistence, independent replication or donor-population generalization. Warnings file is retained, including when empty. Complete gene-level limma statistics, memberships, normalization, mean–variance plot, fitted object and session information are in tables/camera_sensitivity.

The documented fixed correlation 0.01 is a declared comparison, not an independent confirmation. Full normalization and residual-correlation runtime verification are archived in `provenance/`.
