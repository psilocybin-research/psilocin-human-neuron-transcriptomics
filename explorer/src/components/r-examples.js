// Examples explore archived estimates; they do not reproduce the original fits.
export const rExamples = [
  {
    id: "pathways",
    title: "Primary pathway enrichment",
    code: `# Archived fgsea estimates: NES is not a biological effect size.
# Preserve the original 15-test BH family; do not adjust this subset again.
results <- subset(pathways, tier == "primary")
stopifnot(nrow(results) == 15, all(is.finite(results$NES)))
# Keep the comparison and original family FDR visible in tables and reports.
results <- results[, c("pathway", "contrast", "NES", "family_fdr", "robustness")]
print(results)
contrast_id <- "day1_vs_control" # EDIT: day3_vs_control or day3_vs_day1
x <- subset(results, contrast == contrast_id)
x <- x[order(x$NES), ]
par(mar = c(5, 15, 3, 1))
barplot(x$NES, names.arg = sub("HALLMARK_", "", x$pathway),
        horiz = TRUE, las = 1, col = "#39769a", border = NA,
        xlab = "Normalized enrichment score", main = contrast_id)
abline(v = 0, col = "grey50")`,
  },
  {
    id: "gene",
    title: "Gene effects and uncertainty",
    code: `# Approximate 95% Wald intervals from archived, unshrunken estimates.
# Three contrasts share data; they are not independent replications.
gene_symbol <- "GPX4" # EDIT: source gene symbol
results <- subset(genes, symbol == gene_symbol & selected)
results <- results[match(c("day1_vs_control", "day3_vs_control", "day3_vs_day1"), results$contrast), ]
print(results[, c("symbol", "contrast", "log2FoldChange", "lfcSE", "padj")])
stopifnot(nrow(results) == 3, all(is.finite(results$log2FoldChange)),
          all(is.finite(results$lfcSE)), all(results$lfcSE >= 0))
lo <- results$log2FoldChange - 1.96 * results$lfcSE
hi <- results$log2FoldChange + 1.96 * results$lfcSE
par(mar = c(5, 12, 3, 1))
plot(results$log2FoldChange, seq_len(nrow(results)), xlim = range(c(lo, hi, 0)),
     yaxt = "n", ylab = "", xlab = "log2 fold change", pch = 19,
     col = "#235780", main = paste(gene_symbol, "archived estimates"))
axis(2, at = seq_len(nrow(results)), labels = results$contrast, las = 1, cex.axis = .8)
segments(lo, seq_len(nrow(results)), hi, seq_len(nrow(results)), col = "#235780")
abline(v = 0, lty = 2, col = "grey50")`,
  },
  {
    id: "cohort",
    title: "OXPHOS cross-contrast effects",
    code: `# Selected leading-edge cohort: descriptive, not an unbiased genome-wide test.
# Day 3 versus Day 1 is not a treatment-by-time interaction.
results <- landscape[, c("gene", "functional_group", "day1_log2fc", "day3_log2fc")]
print(head(results, 12))
lim <- range(c(results$day1_log2fc, results$day3_log2fc), finite = TRUE)
plot(results$day1_log2fc, results$day3_log2fc, xlim = lim, ylim = lim,
     pch = 19, col = adjustcolor("#235780", alpha.f = .65),
     xlab = "Day 1 / common control: log2 fold change",
     ylab = "Day 3 / common control: log2 fold change",
     main = "OXPHOS leading-edge union (selected cohort)")
abline(a = 0, b = 1, lty = 2, col = "grey50")
abline(h = 0, v = 0, col = "grey85")`,
  },
  {
    id: "profiles",
    title: "Nine pooled expression profiles",
    code: `# Each point is a pooled block x condition profile, not a single cell.
# VST expression is for display; these are not raw counts for DESeq2.
gene_symbol <- "GPX4" # EDIT: gene in the selected OXPHOS cohort
condition_order <- c("Control", "Day 1", "Day 3")
results <- subset(profiles, gene == gene_symbol)
stopifnot(nrow(results) == 9, all(is.finite(results$vst)),
          all(results$condition %in% condition_order))
results$condition <- factor(results$condition, levels = condition_order)
results <- results[order(results$block, results$condition), ]
print(results)
blocks <- unique(results$block)
cols <- setNames(c("#235780", "#cf7800", "#6d8d99"), blocks)
plot(as.integer(results$condition), results$vst, type = "n", xaxt = "n",
     xlab = "Condition", ylab = "VST expression", main = gene_symbol)
axis(1, at = 1:3, labels = condition_order)
for (b in blocks) {
  z <- subset(results, block == b)
  lines(as.integer(z$condition), z$vst, type = "b", pch = 19, col = cols[b])
}
legend("topleft", legend = blocks, col = cols, pch = 19, lty = 1, bty = "n")
# Lines pair the same differentiation block; no cell-level replication or test.`,
  },
  {
    id: "threshold",
    title: "Gene significance thresholds",
    code: `# A descriptive threshold comparison, not a new confirmatory analysis.
# Nominal p < .05 does not control transcriptome-wide false discoveries.
contrast_id <- "day1_vs_control" # EDIT: day3_vs_control or day3_vs_day1
x <- subset(genes, contrast == contrast_id & selected)
stopifnot(nrow(x) > 0, !anyDuplicated(x$id))
cat("Tested p values:", sum(is.finite(x$pvalue)),
    "; available BH-adjusted values:", sum(is.finite(x$padj)), "\n")
# NA adjusted values are unavailable, not evidence of a null effect.
results <- data.frame(criterion = c("Nominal p < 0.05", "Original BH FDR < 0.05"),
                      genes = c(sum(x$pvalue < .05, na.rm = TRUE),
                                sum(x$padj < .05, na.rm = TRUE)))
print(results)
barplot(results$genes, names.arg = results$criterion, col = c("#9ab6c8", "#235780"),
        ylab = "Rank-representative genes", main = contrast_id, border = NA)`,
  },
  {
    id: "bayesian",
    title: "Bayesian OXPHOS: editable priors",
    code: String.raw`# Same bivariate-normal likelihood and prior families as the archived analysis.
# Numerical quadrature replaces PyMC NUTS here. This is an exploratory browser
# approximation, NOT a rerun of the archived sampler or Student-t sensitivity.
# Scores average log2(normalized count+1) over all 182 mapped OXPHOS genes.
# N=3 paired differentiation blocks across 2 backgrounds; genes are not replicates.

# EDIT THESE PRIORS (archived normal grid: 0.25, 0.5, 1 for the two SDs):
effect_sd <- 0.5       # independent Normal(0, effect_sd) means
residual_sd <- 0.5     # HalfNormal(residual_sd) marginal residual SDs
correlation_eta <- 2   # LKJ(eta) correlation prior; eta=2 in the archive
stopifnot(all(is.finite(c(effect_sd, residual_sd, correlation_eta))),
          effect_sd > 0, residual_sd > 0, correlation_eta > 0)

# Increase these to assess numerical resolution; very large grids use memory.
grid_points <- 42
rho_points <- 61
stopifnot(grid_points >= 20, grid_points <= 90, rho_points >= 21, rho_points <= 121)
Y <- as.matrix(bayesian_scores[, c("day1_vs_control", "day3_vs_control")])
storage.mode(Y) <- "double"
stopifnot(nrow(Y) == 3, ncol(Y) == 2, all(is.finite(Y)))
n <- nrow(Y); y <- colMeans(Y)
S <- crossprod(sweep(Y, 2, y))
sd_grid <- exp(seq(log(0.001), log(max(6*residual_sd, 3*max(apply(Y, 2, sd)))), length.out=grid_points))
rho_grid <- seq(-0.995, 0.995, length.out=rho_points)
g <- expand.grid(s1=sd_grid, s3=sd_grid, rho=rho_grid)
one_minus_r2 <- 1-g$rho^2
I11 <- 1/(g$s1^2*one_minus_r2)
I22 <- 1/(g$s3^2*one_minus_r2)
I12 <- -g$rho/(g$s1*g$s3*one_minus_r2)
M11 <- g$s1^2/n + effect_sd^2
M22 <- g$s3^2/n + effect_sd^2
M12 <- g$rho*g$s1*g$s3/n
detM <- M11*M22-M12^2
logw <- -(n-1)/2*log(g$s1^2*g$s3^2*one_minus_r2) - .5*log(detM) -
  .5*(I11*S[1,1]+2*I12*S[1,2]+I22*S[2,2]) -
  .5*(M22*y[1]^2-2*M12*y[1]*y[2]+M11*y[2]^2)/detM +
  dnorm(g$s1,0,residual_sd,log=TRUE)+dnorm(g$s3,0,residual_sd,log=TRUE)+
  (correlation_eta-1)*log(one_minus_r2)+log(g$s1)+log(g$s3)
# Log-SD grids require the two Jacobian terms above. Trapezoid edge weights:
for(v in c("s1","s3","rho")) logw[g[[v]] %in% range(g[[v]])] <- logw[g[[v]] %in% range(g[[v]])]-log(2)
w <- exp(logw-max(logw)); w <- w/sum(w)
edge <- g$s1 %in% range(sd_grid) | g$s3 %in% range(sd_grid) | g$rho %in% range(rho_grid)
cat("Posterior grid-edge mass:", sum(w[edge]), "\n")
if(sum(w[edge])>.01) warning("Grid boundary matters: refine the bounds/resolution before interpreting.")
# Conditional posterior of the two means is analytic normal at each grid point.
Q11 <- n*I11+1/effect_sd^2; Q22 <- n*I22+1/effect_sd^2; Q12 <- n*I12
detQ <- Q11*Q22-Q12^2
V11 <- Q22/detQ; V22 <- Q11/detQ; V12 <- -Q12/detQ
b1 <- n*(I11*y[1]+I12*y[2]); b2 <- n*(I12*y[1]+I22*y[2])
m1 <- V11*b1+V12*b2; m3 <- V12*b1+V22*b2
# Mixture CDFs give equal-tail intervals without Monte Carlo sampling error.
summarize <- function(m,v) {
  s <- sqrt(pmax(v,0)); limits <- range(m-10*s,m+10*s)
  cdf <- function(x) sum(w*pnorm(x,m,s))
  q <- function(p) uniroot(function(x)cdf(x)-p,limits,tol=1e-6)$root
  c(mean=sum(w*m),lower95=q(.025),upper95=q(.975),probability_gt_zero=1-cdf(0))
}
results <- data.frame(parameter=c("mu_day1_vs_control","mu_day3_vs_control","treated_day_difference"),
  rbind(summarize(m1,V11), summarize(m3,V22), summarize(m3-m1,V11+V22-2*V12)),
  effect_sd=effect_sd,residual_sd=residual_sd,correlation_eta=correlation_eta)
print(results)
cat("Original NUTS summaries for matching prior scales (if archived):\n")
print(subset(bayesian_archive, likelihood=="normal" & effect_sd==results$effect_sd[1] & residual_sd==results$residual_sd[1]))
par(mar=c(5,12,3,1))
plot(results$mean,1:3,xlim=range(results$lower95,results$upper95,0),yaxt="n",ylab="",
     xlab="Mean log2(normalized count+1) difference",pch=19,col="#235780",
     main="Bayesian OXPHOS: editable-prior normal model")
axis(2,at=1:3,labels=c("Day 1 / common control","Day 3 / common control","Treated Day 3 - Day 1"),las=1,cex.axis=.75)
segments(results$lower95,1:3,results$upper95,1:3,col="#235780")
abline(v=0,lty=2,col="grey50")
# Report all chosen priors and resolution. Check a finer grid before inference.
# This is relative-expression uncertainty, not respiration, ageing reversal,
# population validation or a treatment-by-time interaction. No ROPE is defined.`,
  },
];
