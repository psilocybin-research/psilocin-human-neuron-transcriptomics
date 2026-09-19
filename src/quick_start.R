#!/usr/bin/env Rscript

# Reproduce the repository's compact R walkthrough from the frozen derived
# tables. This intentionally uses base R so it can run on GitHub without
# restoring the substantially larger analysis environment.

repository_root <- normalizePath(
  Sys.getenv("PSILOCIN_REPOSITORY_ROOT", unset = getwd()),
  mustWork = TRUE
)
output_dir <- file.path(repository_root, "artifacts", "r-quick-start")
dir.create(output_dir, recursive = TRUE, showWarnings = FALSE)

read_required_csv <- function(relative_path, required_columns) {
  path <- file.path(repository_root, relative_path)
  if (!file.exists(path)) {
    stop("Required frozen result is absent: ", relative_path, call. = FALSE)
  }
  result <- read.csv(path, stringsAsFactors = FALSE, check.names = FALSE)
  missing_columns <- setdiff(required_columns, names(result))
  if (length(missing_columns)) {
    stop(
      "Required columns are absent from ", relative_path, ": ",
      paste(missing_columns, collapse = ", "),
      call. = FALSE
    )
  }
  result
}

enrichment <- read_required_csv(
  "tables/transcriptomics/enrichment_primary_model.csv",
  c("pathway", "contrast", "NES", "family_fdr", "robustness", "tier", "variant")
)
primary <- subset(enrichment, tier == "primary" & variant == "primary")
primary <- primary[c("pathway", "contrast", "NES", "family_fdr", "robustness")]
if (nrow(primary) != 15L) {
  stop("Expected 15 prespecified primary tests; found ", nrow(primary), call. = FALSE)
}

oxphos <- subset(primary, pathway == "HALLMARK_OXIDATIVE_PHOSPHORYLATION")
if (nrow(oxphos) != 3L) {
  stop("Expected three OXPHOS contrasts; found ", nrow(oxphos), call. = FALSE)
}

day1 <- read_required_csv(
  "tables/transcriptomics/primary_day1_vs_control_genes.csv",
  c("gene_id", "symbol", "log2FoldChange", "pvalue", "padj")
)
selected_symbols <- c("GPX4", "NDUFB7", "ATP5A1")
selected_genes <- day1[
  day1$symbol %in% selected_symbols,
  c("gene_id", "symbol", "log2FoldChange", "pvalue", "padj")
]
selected_genes <- selected_genes[match(selected_symbols, selected_genes$symbol), ]
if (nrow(selected_genes) != length(selected_symbols) || anyNA(selected_genes$symbol)) {
  stop("Could not resolve all three documented example genes", call. = FALSE)
}

write.csv(primary, file.path(output_dir, "primary-pathways.csv"), row.names = FALSE)
write.csv(oxphos, file.path(output_dir, "oxphos-contrasts.csv"), row.names = FALSE)
write.csv(selected_genes, file.path(output_dir, "selected-day1-genes.csv"), row.names = FALSE)
writeLines(capture.output(sessionInfo()), file.path(output_dir, "session-info.txt"))

format_number <- function(x, digits = 3L) formatC(x, digits = digits, format = "f")
summary_lines <- c(
  "# R quick-start result",
  "",
  paste0("Validated **", nrow(primary), "** prespecified primary pathway tests from the frozen tables."),
  "",
  "## OXPHOS contrasts",
  "",
  "| Contrast | NES | Family FDR | Robustness |",
  "|---|---:|---:|---|",
  vapply(seq_len(nrow(oxphos)), function(index) {
    paste0(
      "| `", oxphos$contrast[index], "` | ", format_number(oxphos$NES[index]),
      " | ", format(oxphos$family_fdr[index], scientific = TRUE, digits = 3L),
      " | ", oxphos$robustness[index], " |"
    )
  }, character(1)),
  "",
  "## Selected Day-1 gene estimates",
  "",
  "| Symbol | log2 fold change | Adjusted p value |",
  "|---|---:|---:|",
  vapply(seq_len(nrow(selected_genes)), function(index) {
    paste0(
      "| ", selected_genes$symbol[index], " | ",
      format_number(selected_genes$log2FoldChange[index]), " | ",
      format(selected_genes$padj[index], scientific = TRUE, digits = 3L), " |"
    )
  }, character(1)),
  "",
  "> These are frozen derived results. Gene-level adjusted p values are transcriptome-wide estimates and are not independent confirmation of pathway enrichment."
)
writeLines(summary_lines, file.path(output_dir, "summary.md"))

cat(paste(summary_lines, collapse = "\n"), "\n")
cat("\nR session\n---------\n")
print(sessionInfo())
