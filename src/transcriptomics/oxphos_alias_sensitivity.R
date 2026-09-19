# Post-freeze sensitivity: recover current HGNC symbols from the older source annotation.
# Frozen primary tables, memberships, rankings and classifications are never modified.
.libPaths(c(normalizePath('.Rlib'), .libPaths()))
suppressPackageStartupMessages({library(fgsea); library(jsonlite); library(digest)})
source('src/transcriptomics/helpers.R')
freeze <- fromJSON('provenance/analysis_freeze.json')
for (p in names(freeze$sha256))
  if (digest(file=p, algo='sha256') != freeze$sha256[[p]]) stop('Frozen input changed: ', p)
out <- 'tables/oxphos_alias'
dir.create(out, recursive=TRUE, showWarnings=FALSE)
hgnc_file <- 'data/raw/hgnc/hgnc_complete_set_2026-09-18.tsv'
if (!file.exists(hgnc_file)) stop('Pinned HGNC download missing: ', hgnc_file)
hgnc <- read.delim(hgnc_file, stringsAsFactors=FALSE, check.names=FALSE)
ann <- read.csv('metadata/schmidt_gene_annotation.csv', stringsAsFactors=FALSE)
map <- read.csv('tables/transcriptomics/gene_mapping.csv', stringsAsFactors=FALSE)
map <- map[map$selected, ]
gs <- fromJSON('config/gene_sets.yaml', simplifyVector=FALSE)
members <- unlist(Filter(function(x) x$id == 'HALLMARK_OXIDATIVE_PHOSPHORYLATION', gs$sets)[[1]]$genes)
missing <- setdiff(members, map$symbol)
ann$stable <- sub('\\..*$', '', ann$gene_id)
map$stable <- sub('\\..*$', '', map$gene_id)
rows <- lapply(missing, function(s) {
  g <- hgnc[hgnc$symbol == s & hgnc$status == 'Approved', ]
  if (nrow(g) != 1L) stop('HGNC approved-symbol cardinality failure: ', s)
  id <- g$ensembl_gene_id
  if (is.na(id) || !nzchar(id)) stop('No HGNC Ensembl ID: ', s)
  source <- ann[ann$stable == id, ]
  if (nrow(source) != 1L) stop('Source Ensembl cardinality failure: ', s)
  selected <- map[map$stable == id, ]
  if (nrow(selected) > 1L) stop('Selected Ensembl cardinality failure: ', s)
  status <- if (nrow(selected) == 1L) 'rescued' else 'excluded_by_frozen_count_or_symbol_filter'
  data.frame(current_symbol=s, hgnc_id=g$hgnc_id, ensembl_stable_id=id,
             source_symbol=source$name, source_gene_id=source$gene_id,
             selected_gene_id=if (nrow(selected)) selected$gene_id else '',
             status=status)
})
aliases <- do.call(rbind, rows)
rescued <- aliases[aliases$status == 'rescued', ]
if (anyDuplicated(rescued$source_symbol) || anyDuplicated(rescued$current_symbol))
  stop('Alias mapping is not one-to-one')
if (any(rescued$source_symbol %in% members)) stop('Old symbols already in frozen membership')
write.csv(aliases, file.path(out, 'alias_mapping.csv'), row.names=FALSE)

cfg <- fromJSON('config/analysis.yaml', simplifyVector=FALSE)
be <- read.csv('tables/transcriptomics/per_block_gene_directions.csv')
blocks <- sort(unique(be$block))
variants <- c('primary', paste0('omit_', blocks), 'RIN_covariate', 'RIN_ge6',
              'one_library_per_group', paste0('block_', blocks))
contrasts <- names(cfg$contrasts)
result <- list()
for (v in variants) for (co in contrasts) {
  if (startsWith(v, 'block_')) {
    b <- be[be$block == sub('^block_', '', v) & be$contrast == co, ]
    rank <- make_rank(b$log2_normalized_ratio, b$symbol)
  } else {
    path <- paste0('tables/transcriptomics/', v, '_', co, '_ranks.csv')
    r <- read.csv(path)
    rank <- make_rank(r$statistic, r$symbol)
  }
  original_rank <- rank
  set.seed(cfg$seed)
  a <- cfg$fgsea
  baseline <- fgseaMultilevel(list(HALLMARK_OXIDATIVE_PHOSPHORYLATION=members),
    original_rank, minSize=a$minSize, maxSize=a$maxSize, eps=a$eps,
    nPermSimple=a$nPermSimple, sampleSize=a$sampleSize,
    scoreType=a$scoreType, gseaParam=a$gseaParam, nproc=a$nproc)
  rename <- match(names(rank), rescued$source_symbol)
  names(rank)[!is.na(rename)] <- rescued$current_symbol[rename[!is.na(rename)]]
  if (anyDuplicated(names(rank))) stop('Alias caused duplicate ranking symbols: ', v, ' ', co)
  rank <- make_rank(unname(rank), names(rank))
  set.seed(cfg$seed)
  fg <- fgseaMultilevel(list(HALLMARK_OXIDATIVE_PHOSPHORYLATION=members), rank,
                       minSize=a$minSize, maxSize=a$maxSize, eps=a$eps,
                       nPermSimple=a$nPermSimple, sampleSize=a$sampleSize,
                       scoreType=a$scoreType, gseaParam=a$gseaParam, nproc=a$nproc)
  result[[paste(v, co, sep=':')]] <- data.frame(
    variant=v, contrast=co, baseline_mapped=as.integer(baseline$size),
    baseline_NES=baseline$NES, baseline_pval=baseline$pval,
    mapped=as.integer(fg$size), NES=fg$NES, pval=fg$pval,
    delta_NES=fg$NES-baseline$NES,
    leading_edge=paste(fg$leadingEdge[[1]], collapse=';'),
    rescued_leading_edge=paste(intersect(fg$leadingEdge[[1]], rescued$current_symbol), collapse=';'))
}
x <- do.call(rbind, result)
x$bonferroni_15 <- pmin(1, x$pval * 15)
write.csv(x, file.path(out, 'all_variants.csv'), row.names=FALSE)
main <- x[x$variant == 'primary', ]
main$robustness <- vapply(seq_len(nrow(main)), function(i) {
  co <- main$contrast[i]
  s <- x[x$contrast == co, ]
  classify_robustness(main$bonferroni_15[i], main$NES[i],
    s$NES[grepl('^(omit_|block_)', s$variant)],
    s$NES[s$variant %in% c('RIN_covariate', 'RIN_ge6', 'one_library_per_group')])
}, character(1))
write.csv(main, file.path(out, 'primary_comparison.csv'), row.names=FALSE)
write_json(list(hgnc_url='https://storage.googleapis.com/public-download-files/hgnc/tsv/tsv/hgnc_complete_set.txt',
  hgnc_sha256=digest(file=hgnc_file, algo='sha256'),
  source_gene_annotation_sha256=digest(file='metadata/schmidt_gene_annotation.csv', algo='sha256'),
  frozen_gene_sets_sha256=digest(file='config/gene_sets.yaml', algo='sha256'),
  analysis_type='post-freeze OXPHOS alias-mapping sensitivity; no primary output replacement',
  rescued=nrow(rescued), still_unmapped=nrow(aliases)-nrow(rescued), seed=cfg$seed),
  file.path(out, 'provenance.json'), auto_unbox=TRUE, pretty=TRUE)
capture.output(sessionInfo(), file='provenance/oxphos_alias_session.txt')
capture.output(warnings(), file='provenance/oxphos_alias_warnings.txt')
print(main[, c('contrast', 'baseline_mapped', 'mapped', 'baseline_NES', 'NES',
               'delta_NES', 'bonferroni_15', 'robustness')])
