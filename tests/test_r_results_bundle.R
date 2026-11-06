#!/usr/bin/env Rscript
# Check the distributed R object against its independently readable source CSVs.
root <- normalizePath(Sys.getenv("PSILOCIN_REPOSITORY_ROOT", unset = getwd()), mustWork = TRUE)
expect <- function(ok, message) if (!isTRUE(ok)) stop(message, call. = FALSE)
x <- readRDS(file.path(root, "data/derived/psilocin_results.rds"))
expect(identical(x$schema_version, "1.0.0"), "Unsupported bundle schema")
expect(identical(x$source_analysis$doi, "10.5281/zenodo.23283595"), "Source archive differs")
expect(!anyDuplicated(x$contents$path), "Repeated table path")
for (i in seq_len(nrow(x$contents))) {
  path <- x$contents$path[i]
  key <- sub("\\.csv$", "", basename(path))
  actual <- if (startsWith(path, "metadata/")) x$metadata[[key]] else x$tables[[basename(dirname(path))]][[key]]
  expected <- read.csv(file.path(root, path), stringsAsFactors = FALSE, check.names = FALSE)
  expect(identical(actual, expected), paste("Table values, types or missingness differ:", path))
  expect(nrow(actual) == x$contents$rows[i] && ncol(actual) == x$contents$columns[i], paste("Index differs:", path))
  definitions <- x$column_dictionary[x$column_dictionary$path == path, ]
  expect(identical(definitions$column, names(actual)), paste("Column dictionary differs:", path))
}
expect(all(file.exists(file.path(root, unique(x$column_dictionary$reference)))), "A field reference is broken")
expect(length(unique(x$tables$bayesian_oxphos$posterior_summary$fit)) == 10L, "Bayesian settings omitted")
expect(nrow(x$tables$camera_sensitivity$all_tests) == 30L, "CAMERA tests omitted")
expect(length(unique(x$tables$camera_sensitivity$all_tests$mode)) == 2L, "CAMERA setting omitted")
expect(nrow(x$metadata$schmidt_analysis_units) == 9L, "Pooled profile metadata differs")
expect(nrow(x$metadata$schmidt_core_samples) == 23L, "Source-library metadata differs")
for (contrast in c("day1_vs_control", "day3_vs_control", "day3_vs_day1")) {
  g <- x$tables$transcriptomics[[paste0("primary_", contrast, "_genes")]]
  expect(nrow(g) > 20000L && all(c("gene_id", "symbol", "log2FoldChange", "padj") %in% names(g)),
         paste("Incomplete primary gene estimates:", contrast))
}
expect(!any(grepl("per_block_gene_directions|_ranks\\.csv$|posterior_draw|fit\\.rds$", x$contents$path)),
       "A deferred bulky object was included")
inputs <- x$provenance$inputs
expect(!anyDuplicated(inputs$path), "Duplicate provenance input")
expect(identical(unname(tools::md5sum(file.path(root, inputs$path))), inputs$md5), "An input checksum differs")
lines <- readLines(file.path(root, "SHA256SUMS"), warn = FALSE)
sha <- setNames(substr(lines, 1, 64), substring(lines, 67))
expect(all(inputs$path %in% names(sha)), "An input is absent from the public checksum manifest")
expect(identical(unname(sha[inputs$path]), inputs$sha256), "Input SHA-256 differs from the manifest")
expect(identical(x$provenance$upstream_manifest_json,
  paste(readLines(file.path(root, "metadata/provenance.json"), warn = FALSE), collapse = "\n")), "Upstream manifest differs")
cat(sprintf("R bundle verified: %d tables; values, types, missingness, settings, references and checksums match.\n", nrow(x$contents)))
