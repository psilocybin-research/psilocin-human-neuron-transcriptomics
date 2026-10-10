# Export fixed normalized scores only; never refit or modify primary objects.
.libPaths(c(normalizePath('.Rlib'), .libPaths()))
suppressPackageStartupMessages({library(DESeq2); library(jsonlite); library(digest)})
f <- fromJSON('provenance/bayesian_oxphos_freeze_v1.json')
for (p in names(c(f$files, f$input_sha256))) {
  expected <- c(f$files, f$input_sha256)[[p]]
  if (digest(file=p, algo='sha256') != expected) stop(paste('Frozen input changed:',p))
}
cfg <- fromJSON('config/bayesian_oxphos_v1.json')
gs <- fromJSON('config/gene_sets.yaml', simplifyVector=FALSE)
sets <- Filter(function(x) x$id == cfg$pathway, gs$sets)
stopifnot(length(sets)==1)
genes <- unlist(sets[[1]]$genes)
mapping <- read.csv('tables/transcriptomics/gene_mapping.csv')
m <- mapping[mapping$selected & mapping$symbol %in% genes,]
stopifnot(length(genes)==200, nrow(m)==182, !anyDuplicated(m$symbol), !anyDuplicated(m$gene_id))
dds <- readRDS('data/processed/schmidt/models/primary.rds')
norm <- counts(dds, normalized=TRUE)
md <- as.data.frame(colData(dds))
stopifnot(all(m$gene_id %in% rownames(norm)), ncol(norm)==9)
x <- log2(norm[m$gene_id,,drop=FALSE]+1)
stopifnot(all(is.finite(x)))
profiles <- data.frame(profile=colnames(norm), block=as.character(md$block), condition=as.character(md$condition), score=colMeans(x), mapped_genes=nrow(m))
stopifnot(!anyDuplicated(paste(profiles$block,profiles$condition)), setequal(profiles$block,cfg$blocks), setequal(profiles$condition,c('control',cfg$conditions)))
out <- 'tables/bayesian_oxphos'
dir.create(out,recursive=TRUE,showWarnings=FALSE)
write.csv(m,file.path(out,'membership.csv'),row.names=FALSE)
write.csv(profiles,file.path(out,'profile_scores.csv'),row.names=FALSE)
writeLines(capture.output(sessionInfo()),'provenance/bayesian_oxphos_R_session.txt')
