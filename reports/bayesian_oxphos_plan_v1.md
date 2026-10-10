# Bayesian OXPHOS sensitivity plan v1 — 10 October 2026

This is a **post hoc uncertainty analysis**, specified after the primary pathway results, leading edges, gene effects and existing block-direction summaries were known. It is not an outcome-blind analysis or an external preregistration. The pathway choice is informed by those results. This document and the machine-readable configuration are locally hash-frozen before constructing the new model outputs.

## Question and estimand

How uncertain is the average OXPHOS-associated expression shift across differentiation blocks, conditional on the two represented backgrounds and the fixed normalization? Use the full originally mapped literal-symbol Hallmark membership, expected 182/200 genes, not leading edges or alias-expanded membership. For each of nine block-by-condition profiles, average log2(DESeq2 normalized count + 1) over those genes. The two treated-minus-control differences per block form one bivariate observation. Gene correlations enter the observed summary; no gene-independence likelihood or gene-based increase in N is used.

The score is a relative, normalized expression summary. It is neither NES nor metabolic flux, has no validated biological-effect threshold, is conditional on normalization and mapping, and does not propagate their uncertainty. Pooling and technical/culture variation contribute to block-level differences; there is no separate measurement-error estimate. Three differentiations across two backgrounds are not three donors. Treat blocks as conditionally exchangeable under the model, state that possible same-background dependence is not separately estimated, and do not infer generalization to donor populations. Failure of that assumption can affect posterior uncertainty.

The target parameters are mean Day-1/control and Day-3/control score differences. Use a joint likelihood to retain within-block covariance induced partly by the common control. A derived treated Day-3 minus Day-1 mean is descriptive, not a drug-by-time interaction. No model reconstructs missing control harvest days.

## Model and priors

For block b, vector d_b ~ MVNormal(mu, Sigma), with independent zero-centered Normal priors on mu components, HalfNormal marginal SD priors and LKJ(2) correlation prior. Fit the full 3 × 3 prior grid: effect SD and residual SD independently each 0.25, 0.5, 1.0 in the score's log2 units. These are deliberately different assumptions about plausible shifts and heterogeneity, not objective or externally calibrated priors. Baseline uses 0.5/0.5; it is not selected from results. Fit one multivariate Student-t(df=4, scale matrix Sigma) sensitivity under baseline priors; for t4 the marginal variance is twice the scale-matrix diagonal, which must be labeled correctly. No fitted tail parameter with N=3.

Generate prior predictive draws before posterior fitting and retain them. Report their score-difference ranges rather than silently removing broad priors. Generate posterior predictive replicate block vectors and compare means, spreads and observed blocks descriptively; these are weak checks with N=3, not model validation. Report posterior intervals for correlation/heterogeneity to expose their limited identification.

## Computation and reporting

Four independent NUTS chains, 2,000 warmup and 4,000 retained draws each, target acceptance .95, seed 104006, one process and single-threaded numerical libraries. Require Rhat <=1.01, bulk/tail ESS >=1,000 for inferred parameters, and zero divergences. If a fit fails, use one declared remedial run with 4,000 warmup, 8,000 retained draws and target acceptance .99; retain initial diagnostics and record the change. Unresolved failure makes that fit computationally unreliable, not negative biological evidence.

Report all nine prior combinations plus t4 sensitivity, posterior means/medians, equal-tail 95% intervals and directional probabilities for the two means and their difference. No ROPE without a defensible expression-scale threshold, no Bayes factors or binary posterior-success rule. Inspect prior dependence in location, width and sign probability, without choosing a favorable prior. Summarize uncertainty even when the posterior is inconclusive. Add no new pathway selection, covariate search, exclusions or new experiments.

Keep primary statistics, freezes and published releases unchanged. Supplementary inclusion depends on computational validity and explanatory value, not positive results. The historical v1.0.1 archive does not contain this extension; any submission inclusion must identify the new materials separately until a subsequent archive is actually published.

## Reproducibility

Configuration: `config/bayesian_oxphos_v1.json`. Input hashes and freeze hash: `provenance/bayesian_oxphos_freeze_v1.json`. Scores are reconstructed from the primary RDS and checked against existing per-block gene differences. Test unique identities, exact membership/normalization joins, duplicate/missing genes, condition sign and shared-control structure using explicit fixtures. Use an isolated `.venv-bayes` environment; capture exact versions and all draws. Methodological workflow: https://arxiv.org/abs/2011.01808; sampler documentation: https://www.pymc.io/projects/docs/en/stable/api/generated/pymc.sample.html.
