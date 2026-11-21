#!/usr/bin/env Rscript
# Explicit, frozen exploratory follow-up. Never invoked by atlas builds.
suppressPackageStartupMessages({library(jsonlite); library(fgsea); library(digest)})
plan_file <- 'config/mitocarta_followup_v1.json'
plan <- fromJSON(plan_file, simplifyVector=FALSE)
stopifnot(as.character(packageVersion('fgsea')) == plan$fgsea_version)
annotation_file <- 'explorer/src/assets/mitochondria/annotations.json'
stopifnot(digest(file=annotation_file, algo='sha256') == plan$annotation_sha256)
annotation <- fromJSON(annotation_file, simplifyVector=FALSE)
entries <- setNames(annotation$entries, vapply(annotation$entries, `[[`, '', 'key'))
sets <- setNames(lapply(annotation$pathways, function(p) unique(unlist(lapply(p$members, function(key) {
  e <- entries[[key]]
  if (length(e$archivedIds) == 1L) sub('\\.[0-9]+$', '', e$archivedIds[[1L]]) else character()
})))), vapply(annotation$pathways, `[[`, '', 'id'))
set.seed(plan$seed)
output <- list(); audits <- list(); warnings <- character()
for (i in seq_along(plan$contrasts)) {
  contrast <- plan$contrasts[[i]]; input <- plan$inputs[[i]]
  stopifnot(digest(file=input$file, algo='sha256') == input$sha256)
  genes <- read.csv(input$file, stringsAsFactors=FALSE)
  ids <- sub('\\.[0-9]+$', '', genes$gene_id)
  stopifnot(!anyDuplicated(ids))
  eligible <- is.finite(genes$stat) & !is.na(ids) & nzchar(ids)
  ranks <- setNames(genes$stat[eligible], ids[eligible])
  ranks <- ranks[order(-ranks, names(ranks), method='radix')]
  results <- withCallingHandlers(fgseaMultilevel(pathways=sets, stats=ranks,
    minSize=plan$minSize, maxSize=plan$maxSize, eps=plan$eps,
    scoreType=plan$scoreType, nPermSimple=plan$nPermSimple, nproc=plan$nproc),
    warning=function(w) { warnings <<- c(warnings, paste(contrast, conditionMessage(w))); invokeRestart('muffleWarning') })
  results <- as.data.frame(results)
  stopifnot(all(is.finite(results$pval)))
  matched <- vapply(sets, function(s) sum(s %in% names(ranks)), 0L)
  expected <- names(matched)[matched >= plan$minSize & matched <= plan$maxSize]
  stopifnot(setequal(results$pathway, expected))
  rows <- lapply(annotation$pathways, function(pathway) {
    name <- pathway$id; index <- match(name, results$pathway); size <- unname(matched[name])
    tested <- !is.na(index)
    list(pathway=name, hierarchy=pathway$hierarchy, contrast=contrast,
      curatedSize=length(pathway$members), matchedSize=size,
      status=if(tested) 'tested' else if(size<plan$minSize) 'below minimum matched size' else 'above maximum matched size',
      pvalue=if(tested) results$pval[index] else NA_real_,
      ES=if(tested) results$ES[index] else NA_real_,
      NES=if(tested) results$NES[index] else NA_real_,
      log2err=if(tested) results$log2err[index] else NA_real_,
      leadingEdge=if(tested) results$leadingEdge[[index]] else character())
  })
  output <- c(output, rows)
  audits[[contrast]] <- list(rankedGenes=length(ranks), omittedNonfinite=sum(!eligible),
    tiedStatisticOccurrences=sum(duplicated(unname(ranks))), testedPathways=nrow(results))
}
pvalues <- vapply(output, `[[`, 0, 'pvalue')
qvalues <- p.adjust(pvalues[is.finite(pvalues)], method='BH')
index <- 0L
for (i in seq_along(output)) {
  if (is.finite(output[[i]]$pvalue)) { index <- index+1L; output[[i]]$qvalue <- unname(qvalues[index]) }
  else output[[i]]$qvalue <- NA_real_
}
metadata <- list(status='Exploratory post-primary follow-up', plan='config/mitocarta_followup_v1.json',
  planSha256=digest(file=plan_file,algo='sha256'), annotationSha256=plan$annotation_sha256,
  family='Joint BH across all tested pathway–contrast pairs', familySize=length(qvalues),
  seed=plan$seed, eps=plan$eps, engine=paste('fgsea',as.character(packageVersion('fgsea'))),
  R=R.version.string, audits=audits, warnings=unique(warnings), limits=plan$limits)
result <- list(metadata=metadata, results=output)
dir.create('tables/mitocarta_followup',recursive=TRUE,showWarnings=FALSE)
write_json(result,'explorer/src/assets/mitochondria/enrichment.json',auto_unbox=TRUE,na='null',digits=NA,pretty=FALSE)
flat <- do.call(rbind,lapply(output,function(r) {
  r$leadingEdge <- paste(r$leadingEdge,collapse=';'); as.data.frame(r,stringsAsFactors=FALSE)
}))
write.csv(flat,'tables/mitocarta_followup/all_pathways.csv',row.names=FALSE,na='')
file.copy('tables/mitocarta_followup/all_pathways.csv','explorer/src/assets/mitochondria/enrichment.csv',overwrite=TRUE)
write_json(metadata,'tables/mitocarta_followup/provenance.json',auto_unbox=TRUE,na='null',digits=NA,pretty=TRUE)
file.copy(plan_file,'explorer/src/assets/mitochondria/analysis-plan.json',overwrite=TRUE)
writeLines(capture.output(sessionInfo()),'tables/mitocarta_followup/sessionInfo.txt')
cat('Reported',nrow(flat),'pathway–contrast pairs;',length(qvalues),'jointly corrected tests.\n')
