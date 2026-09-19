# Schmidt primary results

Newly analyzed frozen v1.0 results; reporting finalized 2026-09-18. The 07:56 UTC local freeze and all recorded input hashes verify unchanged. The existing isolated rebuild reproduced the count matrix and four core result/mapping tables byte-for-byte; this is computational reproduction, not independent biological replication.

Twenty-three libraries were conservatively pooled into nine condition profiles across three differentiation blocks and two cell lines. DESeq2 used `~ block + condition`, rank 5, residual df 4. Primary pathway tests use finite signed Wald ranks and BH across all 15 tests. NES is a competitive enrichment statistic, not a pathway fold change or flux measurement. Gene effects and unshrunken Wald SEs are exported separately.

## Exact frozen rule

- **robust:** primary BH<0.05; all three per-block NES and all leave-one-block-out NES same sign as full model; all three technical/RIN sensitivity NES same sign; all estimable
- **block_dependent:** primary BH<0.05 and any per-block or leave-one-block-out NES zero/opposite sign
- **directionally_consistent_but_uncertain:** primary BH<0.05 but technical sensitivity reverses or any sensitivity not estimable; OR primary BH>=0.05 with all block and technical directions aligned
- **unsupported:** primary BH>=0.05 with incomplete or inconsistent directional support

All three per-block, all three omission and all three technical/RIN directions must agree for “robust.” Smaller sensitivities need not independently attain significance. These labels describe within-dataset directional stability only. A direction reversal in one block overrides an impressive primary FDR.

## All primary tests

| pathway | contrast | NES | pval | family_fdr | direction | robustness | failed_direction_checks |
|---|---|---|---|---|---|---|---|
| HALLMARK_OXIDATIVE_PHOSPHORYLATION | day1_vs_control | 2.4789 | 7.5108e-17 | 5.6331e-16 | positive | robust |  |
| HALLMARK_GLYCOLYSIS | day1_vs_control | 1.6684 | 0.00014796 | 0.00027922 | positive | robust |  |
| HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY | day1_vs_control | 2.0052 | 5.5669e-05 | 0.00016701 | positive | robust |  |
| HALLMARK_MTORC1_SIGNALING | day1_vs_control | 1.3806 | 0.017485 | 0.023843 | positive | robust |  |
| HALLMARK_PI3K_AKT_MTOR_SIGNALING | day1_vs_control | 1.8 | 0.00014892 | 0.00027922 | positive | robust |  |
| HALLMARK_OXIDATIVE_PHOSPHORYLATION | day3_vs_control | 2.4959 | 1.7644e-17 | 2.6466e-16 | positive | robust |  |
| HALLMARK_GLYCOLYSIS | day3_vs_control | 1.4889 | 0.0045068 | 0.0067602 | positive | block-dependent | block_68_3__batch2;block_69_2__batch1 |
| HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY | day3_vs_control | 2.2268 | 9.4209e-07 | 4.7104e-06 | positive | robust |  |
| HALLMARK_MTORC1_SIGNALING | day3_vs_control | 1.1818 | 0.13602 | 0.15694 | positive | unsupported | block_69_2__batch1;omit_68_3__batch1;omit_68_3__batch2 |
| HALLMARK_PI3K_AKT_MTOR_SIGNALING | day3_vs_control | 1.7921 | 0.00010373 | 0.00025932 | positive | robust |  |
| HALLMARK_OXIDATIVE_PHOSPHORYLATION | day3_vs_day1 | -1.8269 | 1.0744e-05 | 4.029e-05 | negative | block-dependent | block_68_3__batch2;omit_69_2__batch1;RIN_covariate;RIN_ge6 |
| HALLMARK_GLYCOLYSIS | day3_vs_day1 | -1.571 | 0.00064325 | 0.0010721 | negative | directionally consistent but uncertain | RIN_covariate;RIN_ge6 |
| HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY | day3_vs_day1 | -1.191 | 0.19749 | 0.21159 | negative | unsupported | block_68_3__batch2;omit_69_2__batch1;RIN_covariate;RIN_ge6 |
| HALLMARK_MTORC1_SIGNALING | day3_vs_day1 | -1.3585 | 0.020875 | 0.026094 | negative | block-dependent | block_68_3__batch2;omit_69_2__batch1 |
| HALLMARK_PI3K_AKT_MTOR_SIGNALING | day3_vs_day1 | -1.1123 | 0.24828 | 0.24828 | negative | unsupported | block_68_3__batch2 |

A. Day 1 versus the available control: all five anchors pass the rule. B. Day 3 versus the available control: OXPHOS, ROS and PI3K–AKT–mTOR pass; glycolysis is block-dependent and mTORC1 unsupported. C. Treatment-specific temporal evolution: unidentifiable because control harvest days remain unresolved. None of the treated Day-3-minus-Day-1 anchors passes the robustness rule. Neither differences in NES nor significance at only one day establish a return to baseline.

### HALLMARK_OXIDATIVE_PHOSPHORYLATION — day1_vs_control

Primary NES 2.47891; nominal p 7.51077e-17; 15-test BH 5.63308e-16; robust. FDR gate passes; failed directional checks: none.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | 2.4789 | 7.5108e-17 | 5.6331e-16 |
| omit_68_3__batch1 | 2.3096 | 3.6583e-14 | 2.7437e-13 |
| omit_68_3__batch2 | 2.3992 | 5.1516e-16 | 3.8637e-15 |
| omit_69_2__batch1 | 2.4942 | 3.3043e-18 | 2.4782e-17 |
| RIN_covariate | 2.4578 | 4.3691e-16 | 6.5536e-15 |
| RIN_ge6 | 2.6251 | 1.0683e-18 | 8.3519e-18 |
| one_library_per_group | 2.4444 | 1.3749e-16 | 1.0312e-15 |
| block_68_3__batch1 | 2.113 | 3.6804e-10 | 5.5206e-09 |
| block_68_3__batch2 | 1.993 | 6.7041e-08 | 5.0281e-07 |
| block_69_2__batch1 | 1.9041 | 4.3257e-07 | 3.2443e-06 |

Full primary leading edge: GPX4;TIMM13;CYC1;COX8A;NDUFS6;OGDH;HSD17B10;MRPS12;NDUFB2;CYB5R3;RHOT2;UQCRC1;MDH2;NDUFS8;COX6B1;POLR2F;MRPS15;ATP6V1F;SLC25A11;COX10;SLC25A5;ACO2;MFN2;NDUFV1;ECI1;ACAA1;ECHS1;UQCR10;COX4I1;IDH2;TIMM8B;TIMM50;ECH1;NDUFA3;COX5B;SLC25A6;NDUFA2;COX17;UQCRQ;ETFB;MRPL15;GPI;NDUFA8;UQCR11;BAX;MRPL11;ATP6V0C;TOMM22;NDUFB7;TIMM10;TCIRG1;IDH3B;IDH3G;PHYH;SDHB;SLC25A3;GRPEL1;CYCS;PDHA1;SLC25A4;NDUFA1;ATP6V0B;UQCRFS1;NDUFB6;NDUFS3;NDUFAB1;ATP6V1E1;PHB2;NDUFA9;PMPCA;NDUFS7;GOT2;MRPS11;COX7C;VDAC1;SDHC;COX6C;HTRA2;NDUFS4;NDUFB3;SURF1;COX7B;MRPL34;ALAS1;COX5A;COX6A1;NDUFB8;NDUFA7;SDHA;DLST;ATP6AP1;UQCRC2;UQCRH;POR;FH.

### HALLMARK_GLYCOLYSIS — day1_vs_control

Primary NES 1.66841; nominal p 0.000147964; 15-test BH 0.000279217; robust. FDR gate passes; failed directional checks: none.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | 1.6684 | 0.00014796 | 0.00027922 |
| omit_68_3__batch1 | 1.6033 | 0.00036117 | 0.00077393 |
| omit_68_3__batch2 | 1.6563 | 0.00010035 | 0.00025088 |
| omit_69_2__batch1 | 1.597 | 0.0006559 | 0.0012298 |
| RIN_covariate | 1.6014 | 0.00033064 | 0.0008266 |
| RIN_ge6 | 1.3844 | 0.013935 | 0.020903 |
| one_library_per_group | 1.8456 | 2.2163e-06 | 8.311e-06 |
| block_68_3__batch1 | 1.4651 | 0.0065027 | 0.013934 |
| block_68_3__batch2 | 1.1362 | 0.15226 | 0.25881 |
| block_69_2__batch1 | 1.5385 | 0.0020554 | 0.0077077 |

Full primary leading edge: ALDOA;GYS1;SPAG4;ENO1;CLN6;FKBP4;PGLS;TPI1;MDH2;ARTN;TALDO1;GAL3ST1;B4GALT2;PKM;GPC1;SLC25A10;B4GALT7;DPYSL4;MPI;PSMC4;AGRN;B3GALT6;PC;GALE;G6PD;CACNA1H;PGAM1;PYGB;IGFBP3;ME1;PGK1;PFKP;XYLT2;RBCK1;POLR3K;GMPPB;HSPA5;HDLBP;HAX1;QSOX1;LHPP;ENO2;B3GAT1;MED24;TXN;CITED2;IDUA;MIF;ISG20;SDC3;NOL3;B3GAT3;GOT2;ALG1;CHPF2;PLOD1;SLC16A3;CHST1;CXCR4;CHPF;SDHC;PPIA;SOD1;PRPS1;IER3;IL13RA1;PDK3;ELF3;PGM2;GALK1;NSDHL;EFNA3;BIK;CD44;ME2;CLDN9.

### HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY — day1_vs_control

Primary NES 2.00521; nominal p 5.56688e-05; 15-test BH 0.000167006; robust. FDR gate passes; failed directional checks: none.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | 2.0052 | 5.5669e-05 | 0.00016701 |
| omit_68_3__batch1 | 1.9661 | 0.0001611 | 0.00040275 |
| omit_68_3__batch2 | 1.8953 | 0.00037274 | 0.00069888 |
| omit_69_2__batch1 | 1.9554 | 0.0001331 | 0.00033274 |
| RIN_covariate | 1.8837 | 0.00031272 | 0.0008266 |
| RIN_ge6 | 1.8203 | 0.0010775 | 0.002309 |
| one_library_per_group | 1.9343 | 0.00014984 | 0.00032108 |
| block_68_3__batch1 | 1.8288 | 0.00071807 | 0.0021542 |
| block_68_3__batch2 | 1.7973 | 0.0011945 | 0.0035835 |
| block_69_2__batch1 | 1.6409 | 0.0069602 | 0.017451 |

Full primary leading edge: JUNB;GPX4;SBNO2;PRDX2;HMOX2;STK25;TXNRD2;MSRA;G6PD;CDKN2D;ATOX1;PFKP;NQO1;ERCC2;GLRX2;TXN;EGLN2;FTL;LAMTOR5;SOD1;PRDX1.

### HALLMARK_MTORC1_SIGNALING — day1_vs_control

Primary NES 1.38064; nominal p 0.0174849; 15-test BH 0.023843; robust. FDR gate passes; failed directional checks: none.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | 1.3806 | 0.017485 | 0.023843 |
| omit_68_3__batch1 | 1.2328 | 0.092819 | 0.1071 |
| omit_68_3__batch2 | 1.3381 | 0.02971 | 0.031832 |
| omit_69_2__batch1 | 1.5125 | 0.0016848 | 0.0028079 |
| RIN_covariate | 1.3129 | 0.034064 | 0.056773 |
| RIN_ge6 | 1.522 | 0.0010373 | 0.002309 |
| one_library_per_group | 1.3501 | 0.028772 | 0.035965 |
| block_68_3__batch1 | 1.21 | 0.10518 | 0.15777 |
| block_68_3__batch2 | 0.86299 | 0.85829 | 1 |
| block_69_2__batch1 | 0.94697 | 0.60127 | 0.65971 |

Full primary leading edge: CALR;ALDOA;NFKBIB;STIP1;PPP1R15A;ENO1;TOMM40;GAPDH;RRP9;DDX39A;FKBP2;SQSTM1;TPI1;SERPINH1;GBE1;PSMC4;ABCF2;HSPE1;MCM2;G6PD;CDC25A;GPI;PDAP1;PSMB5;CDKN1A;CORO1A;HSPD1;ME1;PGK1;MAP2K3;YKT6;ARPC5L;CYP51A1;HPRT1;CACYBP;HSPA5;NFYC;SDF2L1;HSP90B1;QDPR;PGM1;CYB5B;MCM4;FDXR;SLC2A1;CCNF;TM7SF2;CXCR4;PPIA;RPN1;PFKL;PRDX1;CFP;HMBS;PSMD13;GLA;DHFR;PNO1;PSME3;PNP;TES.

### HALLMARK_PI3K_AKT_MTOR_SIGNALING — day1_vs_control

Primary NES 1.79999; nominal p 0.000148916; 15-test BH 0.000279217; robust. FDR gate passes; failed directional checks: none.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | 1.8 | 0.00014892 | 0.00027922 |
| omit_68_3__batch1 | 1.561 | 0.0056683 | 0.0094472 |
| omit_68_3__batch2 | 1.6339 | 0.0014033 | 0.0023388 |
| omit_69_2__batch1 | 1.9994 | 3.9556e-06 | 1.4834e-05 |
| RIN_covariate | 1.9173 | 1.3137e-05 | 4.9265e-05 |
| RIN_ge6 | 1.9309 | 1.8632e-05 | 6.9869e-05 |
| one_library_per_group | 1.6957 | 0.00075407 | 0.0012568 |
| block_68_3__batch1 | 1.7337 | 0.00022965 | 0.00086117 |
| block_68_3__batch2 | 1.1814 | 0.15529 | 0.25881 |
| block_69_2__batch1 | 1.2899 | 0.091676 | 0.15279 |

Full primary leading edge: CALR;HRAS;ARHGDIA;ECSIT;NFKBIB;PPP1CA;SQSTM1;TRAF2;RPTOR;AKT1;PIN1;AP2M1;CFL1;AKT1S1;PFN1;MKNK2;PAK4;TSC2;CDKN1A;DUSP3;ARF1;MAP2K3;RPS6KA1;RALB;HSP90B1;MYD88;MAPKAP1;CDK4;E2F1;SLC2A1.

### HALLMARK_OXIDATIVE_PHOSPHORYLATION — day3_vs_control

Primary NES 2.49587; nominal p 1.76437e-17; 15-test BH 2.64655e-16; robust. FDR gate passes; failed directional checks: none.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | 2.4959 | 1.7644e-17 | 2.6466e-16 |
| omit_68_3__batch1 | 2.8327 | 4.3501e-23 | 6.5251e-22 |
| omit_68_3__batch2 | 1.8824 | 8.6781e-07 | 4.339e-06 |
| omit_69_2__batch1 | 2.3685 | 3.4571e-20 | 5.1856e-19 |
| RIN_covariate | 2.1654 | 5.1442e-15 | 3.8581e-14 |
| RIN_ge6 | 2.4708 | 1.1136e-18 | 8.3519e-18 |
| one_library_per_group | 2.7362 | 2.1112e-19 | 3.1668e-18 |
| block_68_3__batch1 | 1.9587 | 1.8664e-08 | 1.3998e-07 |
| block_68_3__batch2 | 2.7609 | 5.9578e-21 | 8.9366e-20 |
| block_69_2__batch1 | 0.97945 | 0.50476 | 0.65971 |

Full primary leading edge: NDUFS6;SLC25A11;OGDH;HSD17B10;COX6B1;TIMM13;GPX4;GPI;COX4I1;CYC1;UQCRC1;COX8A;ACO2;MFN2;ATP6V1F;ECHS1;UQCR10;NDUFA8;SLC25A6;IDH2;POLR2F;CYB5R3;IDH3G;NDUFA3;MDH2;TIMM10;TOMM22;NDUFV1;ECH1;TIMM8B;SLC25A5;NDUFS8;UQCR11;ACAA1;BAX;ETFB;NDUFB2;TIMM50;MRPL11;GRPEL1;NDUFA2;COX5B;COX10;PHB2;MRPS11;MRPS12;IDH3B;NDUFS3;NDUFB7;GOT2;MRPS15;ATP6V0B;COX7C;ECI1;SLC25A4;SDHC;NDUFB6;UQCRH;NDUFA1;COX17;NDUFB8;ATP6AP1;SDHA;UQCRFS1;RHOT2;ALAS1;UQCRQ;ATP6V1E1;NDUFA9;COX6C;VDAC1;LDHA;COX5A;POR;COX7B;COX7A2;NDUFAB1;FH;NDUFS4;CS;NQO2;PHYH;SURF1;SDHB;MGST3;ATP6V0C;IMMT;HADHA;PMPCA;DLST;PDHA1;MRPL15;MRPL35;ATP6V1H;SLC25A3;UQCRC2;LDHB;FXN;ALDH6A1;COX7A2L;NDUFB4;NDUFS2;IDH1;AFG3L2;COX6A1;ATP6V1G1;HTRA2.

### HALLMARK_GLYCOLYSIS — day3_vs_control

Primary NES 1.4889; nominal p 0.00450682; 15-test BH 0.00676024; block-dependent. FDR gate passes; failed directional checks: block_68_3__batch2;block_69_2__batch1.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | 1.4889 | 0.0045068 | 0.0067602 |
| omit_68_3__batch1 | 1.2511 | 0.061576 | 0.07697 |
| omit_68_3__batch2 | 1.4074 | 0.01472 | 0.0184 |
| omit_69_2__batch1 | 1.5834 | 0.00025733 | 0.00055142 |
| RIN_covariate | 1.5168 | 0.00083138 | 0.0017815 |
| RIN_ge6 | 1.4824 | 0.0042786 | 0.0080223 |
| one_library_per_group | 1.3659 | 0.022866 | 0.031181 |
| block_68_3__batch1 | 1.541 | 0.0011917 | 0.0029792 |
| block_68_3__batch2 | -0.69765 | 0.98284 | 1 |
| block_69_2__batch1 | -0.94845 | 0.58519 | 0.65971 |

Full primary leading edge: PKM;TPI1;ALDOA;B4GALT2;PGLS;G6PD;ENO1;TALDO1;GYS1;PC;CLN6;PYGB;DPYSL4;MED24;PGAM1;ENO2;MDH2;SLC25A10;SDC3;B4GALT7;B3GAT1;CACNA1H;MPI;EFNA3;CAPN5;FKBP4;B3GALT6;GPC1;ARTN;GALE;GOT2;QSOX1;PFKP;POLR3K;GAL3ST1;AGRN;PPIA;NSDHL;STMN1;HDLBP;RBCK1;PRPS1;SDHC;PGK1;B3GAT3;TXN;SOD1;XYLT2;GOT1;PSMC4;SLC25A13;HAX1;MIF;LDHA.

### HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY — day3_vs_control

Primary NES 2.22685; nominal p 9.42089e-07; 15-test BH 4.71045e-06; robust. FDR gate passes; failed directional checks: none.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | 2.2268 | 9.4209e-07 | 4.7104e-06 |
| omit_68_3__batch1 | 2.4338 | 5.5806e-08 | 2.7903e-07 |
| omit_68_3__batch2 | 2.0279 | 3.8616e-05 | 0.00014481 |
| omit_69_2__batch1 | 2.0944 | 1.0413e-06 | 5.2066e-06 |
| RIN_covariate | 2.0316 | 2.4646e-06 | 1.2323e-05 |
| RIN_ge6 | 2.1469 | 1.6836e-06 | 8.4181e-06 |
| one_library_per_group | 2.4227 | 1.4652e-07 | 7.3259e-07 |
| block_68_3__batch1 | 1.9705 | 4.4437e-05 | 0.00022218 |
| block_68_3__batch2 | 2.2981 | 1.5316e-06 | 7.6579e-06 |
| block_69_2__batch1 | 0.86226 | 0.69721 | 0.69721 |

Full primary leading edge: PRDX2;GPX4;G6PD;HMOX2;SBNO2;ATOX1;FTL;CDKN2D;STK25;ERCC2;MSRA;PDLIM1;EGLN2;TXNRD2;PFKP;NQO1;TXN;SOD1.

### HALLMARK_MTORC1_SIGNALING — day3_vs_control

Primary NES 1.18179; nominal p 0.136019; 15-test BH 0.156944; unsupported. FDR gate fails; failed directional checks: block_69_2__batch1;omit_68_3__batch1;omit_68_3__batch2.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | 1.1818 | 0.13602 | 0.15694 |
| omit_68_3__batch1 | -1.3169 | 0.029556 | 0.044333 |
| omit_68_3__batch2 | -1.2401 | 0.042099 | 0.042099 |
| omit_69_2__batch1 | 1.4741 | 0.002225 | 0.0033376 |
| RIN_covariate | 1.1244 | 0.23187 | 0.28983 |
| RIN_ge6 | 1.1989 | 0.12169 | 0.16166 |
| one_library_per_group | 1.1563 | 0.15473 | 0.15473 |
| block_68_3__batch1 | 1.2342 | 0.08968 | 0.14947 |
| block_68_3__batch2 | 1.0343 | 0.33359 | 0.50038 |
| block_69_2__batch1 | -1.3271 | 0.031944 | 0.068451 |

Full primary leading edge: TPI1;ALDOA;GAPDH;RRP9;GPI;G6PD;CALR;PSMB5;ENO1;SQSTM1;TOMM40;PDAP1;DDX39A;ABCF2;STIP1;NFKBIB;MCM2;FKBP2;CYB5B;CCNF;GBE1;ACLY;PIK3R3;MAP2K3;CYP51A1;NFYC;TM7SF2;CDC25A;SLC2A1;TUBG1;PPIA;PPP1R15A;PGK1;PSME3;CORO1A;YKT6;MCM4;TES;SLA;QDPR;DHCR7;RPA1;FADS2;NMT1;PSMD13;GOT1;PFKL;PSMC4;DHCR24;LDLR;LDHA;TMEM97.

### HALLMARK_PI3K_AKT_MTOR_SIGNALING — day3_vs_control

Primary NES 1.79211; nominal p 0.000103728; 15-test BH 0.00025932; robust. FDR gate passes; failed directional checks: none.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | 1.7921 | 0.00010373 | 0.00025932 |
| omit_68_3__batch1 | 1.8667 | 6.1077e-05 | 0.00018323 |
| omit_68_3__batch2 | 1.5887 | 0.003632 | 0.0049527 |
| omit_69_2__batch1 | 1.7993 | 6.9436e-05 | 0.00020831 |
| RIN_covariate | 1.5466 | 0.0043954 | 0.0082413 |
| RIN_ge6 | 1.651 | 0.00099969 | 0.002309 |
| one_library_per_group | 1.7798 | 0.00034192 | 0.00064111 |
| block_68_3__batch1 | 1.4107 | 0.030679 | 0.057523 |
| block_68_3__batch2 | 1.6389 | 0.00065557 | 0.0024584 |
| block_69_2__batch1 | 0.9275 | 0.61573 | 0.65971 |

Full primary leading edge: HRAS;PPP1CA;ECSIT;AP2M1;CFL1;ARHGDIA;CALR;SQSTM1;AKT1;PFN1;TRAF2;NFKBIB;RPTOR;TSC2;RPS6KA1;PAK4;AKT1S1;PIN1;PIK3R3;MKNK2;MAP2K3;GRB2;RALB;SLC2A1.

### HALLMARK_OXIDATIVE_PHOSPHORYLATION — day3_vs_day1

Primary NES -1.82688; nominal p 1.0744e-05; 15-test BH 4.02901e-05; block-dependent. FDR gate passes; failed directional checks: block_68_3__batch2;omit_69_2__batch1;RIN_covariate;RIN_ge6.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | -1.8269 | 1.0744e-05 | 4.029e-05 |
| omit_68_3__batch1 | -1.6057 | 0.00052625 | 0.00098672 |
| omit_68_3__batch2 | -2.5828 | 2.4242e-18 | 3.6364e-17 |
| omit_69_2__batch1 | 0.94332 | 0.60566 | 0.64892 |
| RIN_covariate | 0.86236 | 0.79718 | 0.79718 |
| RIN_ge6 | 0.69946 | 0.99027 | 0.99027 |
| one_library_per_group | -1.8502 | 4.0685e-06 | 1.2206e-05 |
| block_68_3__batch1 | -1.0635 | 0.30318 | 0.37897 |
| block_68_3__batch2 | 1.4083 | 0.0048952 | 0.012238 |
| block_69_2__batch1 | -1.9498 | 2.0715e-08 | 3.1073e-07 |

Full primary leading edge: RHOT2;MRPS12;CYCS;GPX4;TCIRG1;MRPL15;NDUFB2;NDUFV2;MRPS15;TIMM13;ATP6V0C;ECI1;CYC1;UQCRQ;COX10;SLC25A3;MPC1;COX17;PHYH;COX8A;SDHB;NDUFS8;PDHA1;MRPL34;CYB5R3;SLC25A5;MDH2;NDUFA7;HSPA9;ACAA1;NDUFS7;NDUFV1;NDUFAB1;FDX1;NDUFB3;SLC25A20;NDUFS6;TIMM50;HSD17B10;OGDH;POLR2F;COX5B;TIMM8B;NDUFA2;PMPCA;UQCRFS1;NDUFA1;NDUFB7;HTRA2;ATP1B1;ECH1;TIMM9;ATP6V1F;NDUFB6;IDH3A;ETFB;SLC25A4;UQCRC1;MRPL11;ATP6V1E1;NDUFA9;IDH3B;MTX2;COX6A1;MRPS22;MFN2;SUCLG1;BAX;IDH2;UQCR11;UQCR10;ECHS1;ATP6V0B;OXA1L;ACAT1;VDAC2;SURF1;NDUFS4;NDUFA3;ACO2;MRPS30;ABCB7;DLD;TOMM22;GRPEL1;VDAC1;COX7B;DLAT;TIMM10;NDUFS3;ATP6V0E1;ACADVL;NDUFA6;COX6B1;UQCRC2;SDHD.

### HALLMARK_GLYCOLYSIS — day3_vs_day1

Primary NES -1.57104; nominal p 0.000643251; 15-test BH 0.00107208; directionally consistent but uncertain. FDR gate passes; failed directional checks: RIN_covariate;RIN_ge6.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | -1.571 | 0.00064325 | 0.0010721 |
| omit_68_3__batch1 | -1.7407 | 2.254e-05 | 8.4526e-05 |
| omit_68_3__batch2 | -1.5053 | 0.0026373 | 0.0039559 |
| omit_69_2__batch1 | -1.0748 | 0.26803 | 0.33503 |
| RIN_covariate | 1.0915 | 0.26815 | 0.30941 |
| RIN_ge6 | 1.1892 | 0.12933 | 0.16166 |
| one_library_per_group | -1.7661 | 2.1496e-05 | 5.3739e-05 |
| block_68_3__batch1 | -0.7179 | 0.99244 | 0.99244 |
| block_68_3__batch2 | -1.3072 | 0.040037 | 0.085795 |
| block_69_2__batch1 | -1.6237 | 0.00015404 | 0.0007702 |

Full primary leading edge: SPAG4;COL5A1;FKBP4;HSPA5;ME1;GYS1;CD44;PSMC4;IER3;ALDOA;CLN6;VEGFA;IL13RA1;PMM2;GAL3ST1;ARTN;ISG20;ENO1;CHPF2;KDELR3;GPC1;GMPPB;IGFBP3;AGRN;NOL3;CITED2;TGFA;MPI;IDUA;MDH2;AK4;B3GALT6;GALE;GALK2;B4GALT7;SLC16A3;PAM;AURKA;SLC25A10;ANGPTL4;XYLT2;PDK3;PGK1;STC2;LHPP;CHPF;ELF3;CXCR4;GUSB;NT5E;FAM162A;HAX1;PGLS;RBCK1;ECD;DPYSL4;CHST1;MIF;PLOD1;PYGL;CACNA1H;TPST1;PFKP;BIK;CLDN9;ME2.

### HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY — day3_vs_day1

Primary NES -1.19096; nominal p 0.197487; 15-test BH 0.211593; unsupported. FDR gate fails; failed directional checks: block_68_3__batch2;omit_69_2__batch1;RIN_covariate;RIN_ge6.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | -1.191 | 0.19749 | 0.21159 |
| omit_68_3__batch1 | -1.2726 | 0.13741 | 0.13741 |
| omit_68_3__batch2 | -2.0194 | 7.2185e-05 | 0.00021656 |
| omit_69_2__batch1 | 1.1905 | 0.21099 | 0.28771 |
| RIN_covariate | 1.0511 | 0.37571 | 0.40255 |
| RIN_ge6 | 1.1298 | 0.27656 | 0.31911 |
| one_library_per_group | -1.3577 | 0.079462 | 0.085138 |
| block_68_3__batch1 | -0.93007 | 0.56705 | 0.65429 |
| block_68_3__batch2 | 0.95267 | 0.53911 | 0.73515 |
| block_69_2__batch1 | -1.6459 | 0.0069804 | 0.017451 |

Full primary leading edge: JUNB;PRDX4;SBNO2;GPX4;GLRX2;TXNRD2;STK25;LAMTOR5;HMOX2;GPX3;MSRA.

### HALLMARK_MTORC1_SIGNALING — day3_vs_day1

Primary NES -1.35853; nominal p 0.0208749; 15-test BH 0.0260937; block-dependent. FDR gate passes; failed directional checks: block_68_3__batch2;omit_69_2__batch1.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | -1.3585 | 0.020875 | 0.026094 |
| omit_68_3__batch1 | -1.325 | 0.036571 | 0.04987 |
| omit_68_3__batch2 | -1.6574 | 0.00013979 | 0.00029954 |
| omit_69_2__batch1 | 1.0663 | 0.31308 | 0.36125 |
| RIN_covariate | -1.2312 | 0.059428 | 0.089142 |
| RIN_ge6 | -1.3615 | 0.011006 | 0.018344 |
| one_library_per_group | -1.3411 | 0.031673 | 0.036546 |
| block_68_3__batch1 | -0.86014 | 0.83117 | 0.89054 |
| block_68_3__batch2 | 0.5306 | 1 | 1 |
| block_69_2__batch1 | -1.2735 | 0.064324 | 0.12061 |

Full primary leading edge: SERPINH1;CALR;PPP1R15A;XBP1;HSP90B1;HSPE1;NFKBIB;HSPA5;GLA;STIP1;ME1;BTG2;CDKN1A;PSMC4;FKBP2;ALDOA;DDIT3;TOMM40;SHMT2;PNO1;DDX39A;HSPD1;ENO1;SDF2L1;CACYBP;BHLHE40;HPRT1;ARPC5L;NUFIP1;GBE1;FDXR;RPN1;GAPDH;AK4;RRP9;PNP;HSPA9;SQSTM1;CORO1A;AURKA;CDC25A;CFP;POLR3G;YKT6;PGK1.

### HALLMARK_PI3K_AKT_MTOR_SIGNALING — day3_vs_day1

Primary NES -1.11231; nominal p 0.248285; 15-test BH 0.248285; unsupported. FDR gate fails; failed directional checks: block_68_3__batch2.

| variant | NES | pval | family_fdr |
|---|---|---|---|
| primary | -1.1123 | 0.24828 | 0.24828 |
| omit_68_3__batch1 | -1.2298 | 0.1335 | 0.13741 |
| omit_68_3__batch2 | -1.469 | 0.01766 | 0.020377 |
| omit_69_2__batch1 | -0.88162 | 0.72787 | 0.72787 |
| RIN_covariate | -1.217 | 0.11857 | 0.16168 |
| RIN_ge6 | -0.80703 | 0.89047 | 0.95408 |
| one_library_per_group | -1.4811 | 0.016179 | 0.024269 |
| block_68_3__batch1 | -1.2265 | 0.12557 | 0.17123 |
| block_68_3__batch2 | 0.70555 | 0.98714 | 1 |
| block_69_2__batch1 | -1.2625 | 0.11456 | 0.17184 |

Full primary leading edge: CALR;HSP90B1;NFKBIB;ARHGDIA;MYD88;CDKN1A;DDIT3;ARF1;ECSIT;HRAS;PIN1;RPTOR;DUSP3;SQSTM1;TRAF2;FGF22;ARPC3;MKNK2;AKT1S1;PPP1CA;NGF;CXCR4;E2F1;CDK4;FGF17;TRIB3;RIPK1;PAK4;PPP2R1B;AKT1.

## Leading-edge interpretation and deliverables

`tables/transcriptomics/primary_pathway_gene_detail.csv` includes all primary members, fixed selected gene IDs, both control contrasts and treated-time contrast, log2FC/SE/Wald statistic/gene BH, low-RIN-exclusion effects, each block's descriptive direction and leading-edge memberships. Gene-level BH differs from pathway-family BH. Missing genes remain explicit. `primary_pathway_evidence.csv` and its long-form companion include every sensitivity estimate, p/FDR and leading edge.

| pathway | contrast | leading_edge_n | top5_abs_rank_weight_fraction | max_gene_abs_rank_weight_fraction | max_abs_block_mean_fraction |
|---|---|---|---|---|---|
| HALLMARK_OXIDATIVE_PHOSPHORYLATION | day1_vs_control | 95 | 0.091666 | 0.019809 | 0.47819 |
| HALLMARK_GLYCOLYSIS | day1_vs_control | 76 | 0.12902 | 0.028615 | 0.43977 |
| HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY | day1_vs_control | 21 | 0.37976 | 0.083409 | 0.4154 |
| HALLMARK_MTORC1_SIGNALING | day1_vs_control | 61 | 0.1583 | 0.040243 | 0.39517 |
| HALLMARK_PI3K_AKT_MTOR_SIGNALING | day1_vs_control | 30 | 0.28161 | 0.068737 | 0.43723 |
| HALLMARK_OXIDATIVE_PHOSPHORYLATION | day3_vs_control | 107 | 0.086221 | 0.017529 | 0.47033 |
| HALLMARK_GLYCOLYSIS | day3_vs_control | 54 | 0.15485 | 0.032511 | 0.55209 |
| HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY | day3_vs_control | 18 | 0.38314 | 0.089118 | 0.49085 |
| HALLMARK_MTORC1_SIGNALING | day3_vs_control | 52 | 0.16189 | 0.034277 | 0.54671 |
| HALLMARK_PI3K_AKT_MTOR_SIGNALING | day3_vs_control | 24 | 0.29039 | 0.065302 | 0.52398 |
| HALLMARK_OXIDATIVE_PHOSPHORYLATION | day3_vs_day1 | 96 | 0.10614 | 0.024793 | 0.79519 |
| HALLMARK_GLYCOLYSIS | day3_vs_day1 | 66 | 0.16132 | 0.052439 | 0.57562 |
| HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY | day3_vs_day1 | 11 | 0.64086 | 0.2724 | 0.64516 |
| HALLMARK_MTORC1_SIGNALING | day3_vs_day1 | 45 | 0.19808 | 0.046967 | 0.54261 |
| HALLMARK_PI3K_AKT_MTOR_SIGNALING | day3_vs_day1 | 30 | 0.32444 | 0.088285 | 0.78323 |

The weight fractions quantify concentration of absolute Wald hit weights **within** the leading edge; they are not fractions of ES variance, causal contribution or proof against all influence. The maximum block fraction refers to absolute descriptive mean log ratios; block omission is the direct fitted influence check.

| pathway | day1_edge_n | day3_edge_n | shared_n | jaccard |
|---|---|---|---|---|
| HALLMARK_OXIDATIVE_PHOSPHORYLATION | 95 | 107 | 89 | 0.78761 |
| HALLMARK_GLYCOLYSIS | 76 | 54 | 49 | 0.60494 |
| HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY | 21 | 18 | 17 | 0.77273 |
| HALLMARK_MTORC1_SIGNALING | 61 | 52 | 39 | 0.52703 |
| HALLMARK_PI3K_AKT_MTOR_SIGNALING | 30 | 24 | 22 | 0.6875 |

Composition differences are descriptive: leading-edge membership depends on the ranked universe and threshold at the enrichment peak. No formal gene-composition temporal test was frozen. Shared genes and day-only members are fully exported, with no claim that day-only membership proves differential temporal expression.

The OXPHOS leading edges contain multiple respiratory-chain gene families (NDUF, COX, UQCR and SDH) as well as mitochondrial import, translation and intermediary-metabolic genes. This supports broad mitochondrial-associated transcription, not increased ATP synthesis. ROS leading edges include peroxidase, thioredoxin/peroxiredoxin and other stress/signaling components; the Hallmark name does not establish either raised ROS or a specific NRF2–GSH mechanism. Glycolysis includes glycosylation, signaling and other genes; mTOR-associated transcription does not establish kinase activation.

`metabolic_plasticity_overlap.csv` quantifies exact overlaps with six bounded plasticity/signaling sets, including zero overlaps. This post-results annotation is descriptive and does not establish functional independence when overlap is small, or causal mediation when genes are shared. Gene-set membership and leading edges are correlated evidence. Three blocks give a minimum two-sided exhaustive sign-flip p of 0.25; competitive enrichment FDR must not be mistaken for biological-sample significance.

## Literal-symbol coverage limitation

| pathway | original_members | selected_symbol_matches | unmatched_symbols |
|---|---|---|---|
| HALLMARK_OXIDATIVE_PHOSPHORYLATION | 200 | 182 | ATP5F1A;ATP5F1B;ATP5F1C;ATP5F1D;ATP5F1E;ATP5MC1;ATP5MC2;ATP5MC3;ATP5ME;ATP5MF;ATP5MG;ATP5PB;ATP5PD;ATP5PF;ATP5PO;BCKDHA;CASP7;TOMM70 |
| HALLMARK_GLYCOLYSIS | 200 | 184 | B3GNT3;CHST4;CLDN3;DEPDC1;ERO1A;GAPDHS;GFUS;GPR87;KIF20A;LCT;LDHC;MIOX;PGAM2;RARS1;TFF3;TKTL1 |
| HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY | 49 | 42 | FES;HHEX;LSP1;MPO;PTPA;SELENOS;SRXN1 |
| HALLMARK_MTORC1_SIGNALING | 200 | 189 | ATP5MC1;DAPP1;EPRS1;ERO1A;IFI30;ITGB2;NHERF1;NIBAN1;NUPR1;RRM2;WARS1 |
| HALLMARK_PI3K_AKT_MTOR_SIGNALING | 105 | 96 | DAPP1;FASLG;FGF6;GNGT1;GRK2;IL4;LCK;PITX2;SFN |

OXPHOS has 182/200 literal symbol matches. Fifteen unmatched ATP5-prefixed membership symbols coexist with differently named ATP5 symbols in the source counts. The frozen no-alias-rescue rule is preserved. In particular, the absence of these ATP-synthase symbols from leading edges cannot be interpreted as absence of their transcripts or a specific lack of complex-V response. No post-results remapping test was added. `primary_leading_edge_overlap.csv` quantifies all pairwise primary leading-edge overlaps within each contrast.
