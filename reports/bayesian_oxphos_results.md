# Bayesian OXPHOS sensitivity — completed 10 October 2026

All ten final fits met the frozen computational criteria: maximum Rhat 1.0017, minimum bulk ESS 4277, minimum tail ESS 4602, and 0 divergences.

Day 1: normal-grid posterior means ranged from 0.263 to 0.345; 95% interval widths ranged from 0.421 to 0.840; P(>0) ranged from 0.936 to 0.992. Day 3: normal-grid posterior means ranged from 0.160 to 0.226; 95% interval widths ranged from 0.476 to 1.028; P(>0) ranged from 0.866 to 0.954. Treated Day 3 minus Day 1: normal-grid posterior means ranged from -0.125 to -0.102; 95% interval widths ranged from 0.664 to 1.380; P(>0) ranged from 0.217 to 0.298.

| Likelihood; prior SDs | Day 1 mean [95% CrI] | Day 3 mean [95% CrI] | D3 − D1 mean [95% CrI] |
|---|---|---|---|
| Normal; 0.25/0.25 | 0.304 [0.057, 0.478] | 0.188 [-0.076, 0.400] | -0.116 [-0.446, 0.219] |
| Normal; 0.25/0.5 | 0.281 [-0.050, 0.485] | 0.170 [-0.154, 0.420] | -0.110 [-0.497, 0.303] |
| Normal; 0.25/1 | 0.263 [-0.125, 0.492] | 0.160 [-0.193, 0.427] | -0.102 [-0.528, 0.355] |
| Normal; 0.5/0.25 | 0.335 [0.103, 0.538] | 0.213 [-0.065, 0.468] | -0.122 [-0.490, 0.247] |
| Normal; 0.5/0.5 | 0.326 [0.004, 0.581] | 0.201 [-0.179, 0.530] | -0.125 [-0.596, 0.351] |
| Normal; 0.5/1 | 0.314 [-0.105, 0.620] | 0.195 [-0.260, 0.578] | -0.119 [-0.669, 0.462] |
| Normal; 1/0.25 | 0.345 [0.112, 0.565] | 0.226 [-0.063, 0.505] | -0.119 [-0.500, 0.269] |
| Normal; 1/0.5 | 0.341 [0.008, 0.645] | 0.218 [-0.187, 0.606] | -0.123 [-0.651, 0.406] |
| Normal; 1/1 | 0.337 [-0.111, 0.728] | 0.214 [-0.323, 0.705] | -0.123 [-0.805, 0.575] |
| Student-t(4); 0.5/0.5 | 0.328 [0.018, 0.583] | 0.214 [-0.145, 0.525] | -0.114 [-0.578, 0.347] |

All original primary outputs remain unchanged. See the full supplementary methods in `reports/bayesian_oxphos_methods.md`, numerical tables in `tables/bayesian_oxphos/`, and hash-indexed full draws in `provenance/bayesian_oxphos_draws/`.
