#!/usr/bin/env Rscript
# Build the R convenience bundle from versioned tables; never refit models.
root <- normalizePath(Sys.getenv("PSILOCIN_REPOSITORY_ROOT", unset = getwd()), mustWork = TRUE)
if (!requireNamespace("digest", quietly = TRUE)) {
  stop("Building the bundle requires the digest package; reading it needs only base R.", call. = FALSE)
}
read_table <- function(path) {
  read.csv(file.path(root, path), stringsAsFactors = FALSE, check.names = FALSE)
}
groups <- c("transcriptomics", "camera_sensitivity", "bayesian_oxphos",
            "targeted_redox", "dna_maintenance", "oxphos_alias")
table_paths <- unlist(lapply(groups, function(group) {
  paths <- sort(list.files(file.path(root, "tables", group), pattern = "\\.csv$", full.names = FALSE))
  if (group == "transcriptomics") {
    paths <- paths[!grepl("_ranks\\.csv$", paths) & paths != "per_block_gene_directions.csv" &
                     (!grepl("_genes\\.csv$", paths) | grepl("^primary_", paths))]
  }
  file.path("tables", group, paths)
}), use.names = FALSE)
metadata_paths <- file.path("metadata", sort(list.files(file.path(root, "metadata"), pattern = "\\.csv$")))
required <- c(paste0("tables/transcriptomics/primary_", c("day1_vs_control", "day3_vs_control", "day3_vs_day1"), "_genes.csv"),
              "tables/transcriptomics/enrichment_all.csv", "tables/camera_sensitivity/all_tests.csv",
              "tables/bayesian_oxphos/posterior_summary.csv", "metadata/schmidt_analysis_units.csv")
if (!all(required %in% c(table_paths, metadata_paths))) stop("A required bundle input is absent.", call. = FALSE)
tables <- setNames(lapply(groups, function(group) {
  paths <- table_paths[dirname(table_paths) == file.path("tables", group)]
  setNames(lapply(paths, read_table), sub("\\.csv$", "", basename(paths)))
}), groups)
metadata <- setNames(lapply(metadata_paths, read_table), sub("\\.csv$", "", basename(metadata_paths)))
index <- do.call(rbind, lapply(c(table_paths, metadata_paths), function(path) {
  x <- read_table(path)
  data.frame(path = path, rows = nrow(x), columns = ncol(x), stringsAsFactors = FALSE)
}))
definitions <- c(
  gene_id = "Ensembl gene identifier as supplied in the source table; versions are retained.",
  symbol = "Gene symbol under the mapping used for this analysis.",
  pathway = "Gene-set identifier; see the frozen specifications and membership tables.",
  contrast = "Comparison being estimated; treated Day 3 minus Day 1 is not a matched-age treatment interaction.",
  variant = "Model or sensitivity-analysis specification.",
  tier = "Declared primary or exploratory pathway tier.",
  baseMean = "Mean DESeq2-normalized count across the profiles in this model.",
  log2FoldChange = "Unshrunken DESeq2 log2 fold-change estimate for the stated contrast.",
  lfcSE = "Standard error of the DESeq2 log2 fold-change estimate.",
  stat = "DESeq2 Wald statistic.",
  pvalue = "Unadjusted gene-level p-value.",
  padj = "DESeq2 transcriptome-wide adjusted gene-level p-value; NA remains missing.",
  pval = "Unadjusted test p-value; the test is identified by the table and method columns.",
  PValue = "Unadjusted limma/CAMERA p-value; gene-level and gene-set tables are distinct.",
  log2FC = "limma-voom fitted log2 expression difference for the stated contrast.",
  moderated_t = "limma empirical-Bayes moderated t statistic.",
  NES = "FGSEA normalized enrichment score; not a gene-expression effect size.",
  ES = "FGSEA enrichment score.",
  family_fdr = "Adjusted p-value within the declared test family; families differ between analyses.",
  fgsea_internal_padj = "FGSEA internal adjustment; the declared family correction is family_fdr.",
  leadingEdge = "Semicolon-separated FGSEA leading-edge gene symbols.",
  mode = "CAMERA inter-gene correlation specification; both settings are retained.",
  Correlation = "CAMERA inter-gene correlation used by this specification.",
  Direction = "CAMERA gene-set direction relative to the ranked transcriptome.",
  variance_inflation_factor = "CAMERA variance inflation due to gene correlation; not an expression effect size.",
  fit = "Bayesian model and prior specification; all ten declared fits are retained.",
  parameter = "Bayesian expression-score parameter; not a respiration measurement.",
  probability_gt_zero = "Posterior probability that the parameter exceeds zero, conditional on its model and priors.",
  block = "Conservative cell-line by differentiation-batch grouping.",
  condition = "Source or analysis condition label; see sample and design metadata.",
  profile = "Pooled block-condition profile identifier.",
  score = "Average log2-normalized expression score across the mapped OXPHOS genes."
)
references <- c(transcriptomics = "reports/schmidt_primary_results.md",
                camera_sensitivity = "reports/camera_sensitivity_methods.md",
                bayesian_oxphos = "reports/bayesian_oxphos_methods.md",
                targeted_redox = "config/targeted_redox_v1.json",
                dna_maintenance = "reports/dna_maintenance_results.md",
                oxphos_alias = "reports/oxphos_alias_sensitivity.md")
dictionary <- do.call(rbind, lapply(c(table_paths, metadata_paths), function(path) {
  x <- read_table(path)
  group <- if (startsWith(path, "metadata/")) "metadata" else basename(dirname(path))
  reference <- if (group == "metadata") "metadata/schmidt_data_dictionary.csv" else references[[group]]
  meaning <- unname(definitions[names(x)])
  meaning[is.na(meaning)] <- paste("Table-specific field; consult", reference)
  if (group == "bayesian_oxphos" && any(names(x) %in% c("lower95", "upper95"))) {
    meaning[names(x) == "lower95"] <- "Lower 95% posterior or predictive bound; consult the table and source column."
    meaning[names(x) == "upper95"] <- "Upper 95% posterior or predictive bound; consult the table and source column."
  }
  data.frame(path = path, column = names(x), R_type = vapply(x, function(y) paste(class(y), collapse = "/"), ""),
             definition = meaning, reference = reference, stringsAsFactors = FALSE)
}))
inputs <- sort(unique(c(table_paths, metadata_paths, "metadata/provenance.json", "src/export_r_results.R")))
provenance <- data.frame(path = inputs,
  bytes = unname(file.info(file.path(root, inputs))$size),
  sha256 = vapply(inputs, function(path) digest::digest(file = file.path(root, path), algo = "sha256"), ""),
  md5 = unname(tools::md5sum(file.path(root, inputs))), stringsAsFactors = FALSE)
bundle <- list(
  schema_version = "1.0.0",
  source_analysis = list(version = "1.2.0", doi = "10.5281/zenodo.23283595",
    note = "Convenience export added on maintained main; not an additional analysis or part of the historical v1.2.0 archive."),
  tables = tables, metadata = metadata, contents = index, column_dictionary = dictionary,
  provenance = list(inputs = provenance,
    upstream_manifest_json = paste(readLines(file.path(root, "metadata/provenance.json"), warn = FALSE), collapse = "\n"),
    R_version = as.character(getRversion()), digest_version = as.character(utils::packageVersion("digest"))),
  scope = "Primary gene estimates, pathway sensitivities, complete CAMERA CSVs, Bayesian summaries and bounded follow-ups. Full sensitivity gene/rank tables, per-block gene directions, posterior draws, raw inputs and fitted models remain separate."
)
out <- file.path(root, "data/derived/psilocin_results.rds")
dir.create(dirname(out), recursive = TRUE, showWarnings = FALSE)
saveRDS(bundle, out, version = 2, compress = "xz")
stopifnot(identical(readRDS(out), bundle))
cat(sprintf("Saved %d result tables and %d metadata tables (%.2f MiB).\n",
            length(table_paths), length(metadata_paths), file.info(out)$size / 1024^2))
