## Post hoc Bayesian OXPHOS uncertainty

This sensitivity was specified locally on 10 October 2026 after primary enrichment results and existing block-level directions were known. The plan and input hashes were frozen before constructing the new scores and posterior outputs. It is neither a preregistration nor an independent replication.

For each of nine pooled profiles, we averaged log2(DESeq2-normalized count + 1) across all 182 originally mapped Hallmark OXPHOS genes; leading-edge selection and alias expansion were not used. R 4.6.1/DESeq2 exported scores from the existing primary object without refitting. Each differentiation block contributed the pair of treated-minus-common-control differences. All scores were checked against the existing per-gene block differences. Genes and libraries did not increase biological N: three blocks span two backgrounds. Observed Day-1 differences were 0.370, 0.227 and 0.448; Day-3 differences were 0.293, 0.348 and 0.034, respectively.

The bivariate normal likelihood estimated two means and a joint covariance, retaining within-block dependence associated with the common control. Independent zero-centered normal effect priors and half-normal marginal residual-SD priors each used SDs 0.25, 0.5 and 1 in the full nine-combination grid; the correlation prior was LKJ(2). Baseline SDs were fixed at 0.5/0.5 before fitting. A tenth fit used a bivariate Student-t likelihood with fixed four degrees of freedom and baseline priors. For this fit, reported SD parameters describe the scale matrix: residual marginal SDs equal sqrt(2) times the reported scale SDs. Priors are sensitivity assumptions, without external biological calibration.

PyMC 5.25.1 under Python 3.10.12 used four sequential NUTS chains, 2,000 warmup and 4,000 retained iterations per chain, target acceptance 0.95, seed 104006 and one numerical thread. A fit failing Rhat <=1.01, bulk/tail ESS >=1,000 or zero divergences received one prespecified rerun with 4,000 warmup, 8,000 retained draws and target acceptance 0.99. Initial and remedial diagnostics are retained. Five thousand prior-predictive draws preceded fitting; posterior-predictive block vectors were then generated. The tables in `tables/bayesian_oxphos/` supply prior/posterior intervals, width ratios, heterogeneity, correlation, observed scores, every computational attempt and descriptive predictive checks. With only three blocks, these predictive comparisons do not validate model adequacy. Prior sensitivity, computational diagnostics and predictive checks follow the principles described in Bayesian Data Analysis and Bayesian Workflow (Gelman et al., Bayesian Data Analysis, 3rd ed., doi:10.1201/b16018; Gelman et al., Bayesian Workflow, 2020 preprint, doi:10.48550/arXiv.2011.01808).

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

**Table note: interval interpretation.** CrI denotes an equal-tail 95% Bayesian credible interval: given the observed data, specified model and priors, the parameter has 95% posterior probability of lying within this interval. A frequentist 95% confidence interval comes from a procedure that would cover the fixed parameter in 95% of repeated samples under its assumptions.

Directional probabilities are continuous posterior summaries, not a new significance or success rule. The derived treated-day difference does not estimate a drug-by-time interaction because control harvest days remain unresolved. No ROPE or Bayes factor was used: this normalized expression summary has no validated threshold for biological equivalence.

Block exchangeability is an assumption conditional on the represented backgrounds; dependence between the two same-background differentiations cannot be separately estimated. This model does not establish donor-population generalization. Normalization and gene mapping are treated as fixed, and no separate measurement-error model is fitted. The score measures relative expression, not absolute abundance, respiration or flux. Its posterior addresses a different estimand from competitive ranked-gene enrichment; it cannot convert an enrichment q-value into biological-replication certainty.

Version 1.1.0 includes the frozen specification, sampler, verified derived inputs, diagnostics, complete posterior and predictive draws, and numerical summaries. The historical version 1.0.1 is unchanged.



![Bayesian OXPHOS interval comparison](../figures/bayesian_oxphos/bayesian_oxphos_intervals.pdf)

**Prior and likelihood sensitivity.** All declared Bayesian prior and likelihood sensitivities. Points show posterior medians and bars equal-tail 95% credible intervals; black crosses show the three observed block differences. Blue marks the preselected baseline; brown marks Student-t sensitivity. N denotes normal likelihood. Prior SDs refer to the effect and residual priors, respectively. The treated-day comparison is not a treatment-by-time interaction.
