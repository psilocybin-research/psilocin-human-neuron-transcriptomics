# Exploratory directional evidence for the OXPHOS expression score

This extension was specified on 21 November 2026 after inspecting the existing ten Bayesian fits and their posterior directions. It is a post hoc interpretation and numerical extension, not preregistration or independent replication. The original analysis and submitted packages remain unchanged.

The comparison is H+ (a positive mean score shift) versus H− (a nonpositive shift), separately for Day 1 and Day 3 relative to the common controls. Both hypotheses are normalized restrictions of the same proper encompassing prior. Its symmetric mean prior gives prior odds of one, so BF+/− equals posterior positive probability divided by its complement. This is not a test against an exact-zero model. It adds an evidence interpretation to existing sign probabilities, not new observations or an independent robustness test.

Use the existing bivariate-normal score model, preserving the paired covariance and nuisance priors. The full 3 × 3 prior grid is mandatory; baseline eta=1 and eta=4 assess additional correlation-prior sensitivity. Retain the existing Student-t(4) fit separately. Do not select a favourable prior or interpret credible intervals crossing zero as evidence for absence.

Before interpreting the deterministic calculations, compare base and refined covariance grids, posterior edge mass and published NUTS summaries. Numerical convergence does not validate the likelihood. Export complete settings, input hashes, both-day summaries and convergence diagnostics. Plot all three paired block observations, effect intervals and densities, and a prior-sensitivity surface for log10(BF+/−), centered at equal directional evidence. Browser controls explore bounded prior scales with explicit numerical diagnostics and export; these are outside the immutable archive.

See `config/bayesian_directional_v1.json` for the complete specification. No biologically validated equivalence bound exists for this score. No mitochondrial-activity, donor-population, treatment-by-time or confirmatory claim follows.
