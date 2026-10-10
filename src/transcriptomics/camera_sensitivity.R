# Separately frozen post hoc correlation-aware sensitivity. Does not use primary.rds.
Sys.setenv(OMP_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',MKL_NUM_THREADS='1')
.libPaths(c(normalizePath('.Rlib-camera'),normalizePath('.Rlib'),.libPaths()))
suppressPackageStartupMessages({library(limma);library(DESeq2);library(jsonlite);library(digest)})
source('src/transcriptomics/camera_helpers.R')
freeze<-fromJSON('provenance/camera_sensitivity_freeze_v1.json')
for(p in names(freeze$sha256)) if(digest(file=p,algo='sha256')!=freeze$sha256[[p]]) stop(paste('Frozen sensitivity input changed:',p))
cfg<-fromJSON('config/camera_sensitivity_v1.json',simplifyVector=FALSE)
stopifnot(as.character(packageVersion('limma'))==cfg$limma_version,as.character(packageVersion('statmod'))==cfg$statmod_version)
set.seed(cfg$seed)
out<-if(length(commandArgs(TRUE))) commandArgs(TRUE)[1] else 'tables/camera_sensitivity'
dir.create(out,recursive=TRUE,showWarnings=FALSE)
ct<-as.matrix(read.delim(cfg$input_counts,row.names=1,check.names=FALSE))
ct<-ct[rowSums(ct>=cfg$minimum_count)>=cfg$minimum_samples,,drop=FALSE]
md<-read.csv(cfg$metadata,stringsAsFactors=FALSE)
mp<-read.csv(cfg$mapping,stringsAsFactors=FALSE);mp<-mp[mp$selected,,drop=FALSE]
validated<-validate_camera_inputs(ct,md,mp,unlist(cfg$condition_levels),cfg$expected_profiles)
md<-validated$metadata;design<-validated$design
stopifnot(nrow(ct)==cfg$expected_filtered_genes,nrow(mp)==cfg$expected_symbols,ncol(design)==cfg$expected_rank,nrow(design)-ncol(design)==cfg$residual_df)
# Reproduce normalization only, using all filtered genes as in the original analysis.
dds<-estimateSizeFactors(DESeqDataSetFromMatrix(ct,md,~block+condition))
sf<-sizeFactors(dds)
effective<-sf/exp(mean(log(sf)))*exp(mean(log(colSums(ct))))
y<-ct[mp$gene_id,,drop=FALSE];rownames(y)<-mp$symbol
voom_pdf<-file.path(out,'voom_mean_variance.pdf')
pdf(voom_pdf,width=7,height=5)
v<-voom(y,design=design,lib.size=effective,normalize.method='none',span=.5,plot=TRUE,save.plot=TRUE)
dev.off()
stopifnot(all(is.finite(v$E)),all(is.finite(v$weights)),all(v$weights>0))
sets<-fromJSON(cfg$gene_sets,simplifyVector=FALSE)$sets
sets<-sets[vapply(sets,function(s)s$id %in% unlist(cfg$pathways),logical(1))]
paths<-setNames(lapply(sets,function(s)unlist(s$genes)),vapply(sets,`[[`,'','id'))
index<-ids2indices(paths,identifiers=rownames(y),remove.empty=FALSE)
stopifnot(length(index)==5,all(lengths(index)>=cfg$size_bounds[[1]]),all(lengths(index)<=cfg$size_bounds[[2]]))
membership<-do.call(rbind,lapply(names(paths),function(p)data.frame(pathway=p,symbol=paths[[p]],mapped=paths[[p]] %in% rownames(y))))
write.csv(membership,file.path(out,'membership.csv'),row.names=FALSE)
write.csv(data.frame(profile=rownames(md),block=md$block,condition=md$condition,size_factor=sf,effective_library_size=effective),file.path(out,'normalization.csv'),row.names=FALSE)
write.csv(data.frame(profile=rownames(design),design,check.names=FALSE),file.path(out,'design.csv'),row.names=FALSE)
results<-list();warnings<-character()
for(mode in c('estimated','fixed_0.01')) for(co in names(cfg$contrasts)) {
  contrast<-camera_contrast(co,design)
  stopifnot(identical(unname(contrast),as.numeric(unlist(cfg$contrasts[[co]]))))
  r<-withCallingHandlers(camera(v,index,design=design,contrast=contrast,use.ranks=FALSE,allow.neg.cor=FALSE,
           inter.gene.cor=if(mode=='estimated') NA_real_ else cfg$camera$fixed_correlation,trend.var=FALSE,sort=FALSE,directional=TRUE),
       warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart('muffleWarning')})
  r$pathway<-rownames(r);r$mode<-mode;r$contrast<-co
  if(!'Correlation' %in% names(r)) r$Correlation<-cfg$camera$fixed_correlation
  r$variance_inflation_factor<-1+(r$NGenes-1)*pmax(0,r$Correlation)
  r$camera_per_contrast_FDR<-r$FDR;r$FDR<-NULL
  r$residual_df<-nrow(design)-ncol(design)
  results[[paste(mode,co)]]<-r
}
r<-do.call(rbind,results)
r$family_fdr<-NA_real_
for(mode in unique(r$mode)) {ix<-r$mode==mode;stopifnot(sum(ix)==15);r$family_fdr[ix]<-p.adjust(r$PValue[ix],method='BH',n=15)}
stopifnot(nrow(r)==30,all(is.finite(r$PValue)),all(r$PValue>=0&r$PValue<=1),all(r$Direction %in% c('Up','Down')))
write.csv(r,file.path(out,'all_tests.csv'),row.names=FALSE)
fit<-eBayes(lmFit(v,design));cfit<-contrasts.fit(fit,do.call(cbind,lapply(names(cfg$contrasts),function(co)camera_contrast(co,design))));cfit<-eBayes(cfit)
colnames(cfit$coefficients)<-names(cfg$contrasts)
for(co in names(cfg$contrasts))write.csv(data.frame(symbol=rownames(y),log2FC=cfit$coefficients[,co],moderated_t=cfit$t[,co],PValue=cfit$p.value[,co]),file.path(out,paste0('genes_',co,'.csv')),row.names=FALSE)
saveRDS(list(voom=v,fit=fit,contrast_fit=cfit,metadata=md,design=design,index=index,config=cfg),file.path(out,'fit.rds'))
writeLines(unique(warnings),file.path(out,'warnings.txt'))
capture.output(sessionInfo(),file=file.path(out,'session_info.txt'))
summary<-list(n_profiles=ncol(y),n_filtered=nrow(ct),n_symbols=nrow(y),n_blocks=nlevels(md$block),design_rank=ncol(design),residual_df=nrow(design)-ncol(design),n_tests=nrow(r),versions=lapply(c('limma','statmod','DESeq2','jsonlite','digest'),function(p)list(package=p,version=as.character(packageVersion(p)))),warnings=unique(warnings))
write_json(summary,file.path(out,'audit.json'),pretty=TRUE,auto_unbox=TRUE)
cat('All 30 separately specified CAMERA tests completed.\n')
