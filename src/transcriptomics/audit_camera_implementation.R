# Implementation audit only: no new inferential tests or changed analysis settings.
.libPaths(c(normalizePath('.Rlib-camera'),normalizePath('.Rlib'),.libPaths()))
suppressPackageStartupMessages({library(limma);library(jsonlite);library(digest)})
source('src/transcriptomics/camera_helpers.R')
f<-readRDS('tables/camera_sensitivity/fit.rds')
cfg<-f$config;design<-f$design;md<-f$metadata;v<-f$voom
stopifnot(qr(design)$rank==5,nrow(design)==9,nrow(design)-ncol(design)==4)
stopifnot(identical(rownames(design),colnames(v$E)),identical(rownames(md),colnames(v$E)))
stopifnot(all(table(md$block,md$condition)==1),identical(design,model.matrix(~block+condition,md)))
stopifnot(identical(dim(v$E),dim(v$weights)),all(is.finite(v$weights)),all(v$weights>0))
stopifnot(identical(getEAWP(v)$weights,v$weights))
mp<-read.csv(cfg$mapping);mp<-mp[mp$selected,];stopifnot(identical(rownames(v$E),mp$symbol))
sets<-fromJSON(cfg$gene_sets,simplifyVector=FALSE)$sets
ox<-sets[[which(vapply(sets,function(s)s$id=='HALLMARK_OXIDATIVE_PHOSPHORYLATION',logical(1)))]]
ix<-f$index[['HALLMARK_OXIDATIVE_PHOSPHORYLATION']]
stopifnot(length(ix)==182,setequal(rownames(v$E)[ix],intersect(unlist(ox$genes),rownames(v$E))))
norm<-read.csv('tables/camera_sensitivity/normalization.csv')
ct<-as.matrix(read.delim(cfg$input_counts,row.names=1,check.names=FALSE))
ct<-ct[rowSums(ct>=cfg$minimum_count)>=cfg$minimum_samples,,drop=FALSE]
stopifnot(identical(colnames(ct),norm$profile),max(abs(norm$effective_library_size/(norm$size_factor/exp(mean(log(norm$size_factor)))*exp(mean(log(colSums(ct)))))-1))<1e-12)
all<-read.csv('tables/camera_sensitivity/all_tests.csv');audit<-list()
for(co in names(cfg$contrasts)) {
 contrast<-camera_contrast(co,design);stopifnot(identical(unname(contrast),as.numeric(unlist(cfg$contrasts[[co]]))))
 # Independently reconstruct the weighted QR residual coordinates used by camera.default.
 QR<-qr(contrast);d<-t(qr.qty(QR,t(design)))
 if(sign(QR$qr[1,1]<0)) d[,1]<- -d[,1]
 d<-d[,c(2:ncol(d),1)]
 effects<-vapply(ix,function(g)qr.qty(qr(d*sqrt(v$weights[g,])),v$E[g,]*sqrt(v$weights[g,])),numeric(9))
 U<-effects[-seq_len(ncol(d)),,drop=FALSE];sigma2<-colMeans(U^2)
 U<-t(U)/sqrt(pmax(sigma2,1e-8))
 vif<-length(ix)*mean(colMeans(U)^2);rho<-(vif-1)/(length(ix)-1)
 saved<-all[all$mode=='estimated'&all$contrast==co&all$pathway=='HALLMARK_OXIDATIVE_PHOSPHORYLATION',]
 stopifnot(abs(rho-saved$Correlation)<1e-12,abs(vif-saved$variance_inflation_factor)<1e-10)
 audit[[co]]<-list(contrast=unname(contrast),reconstructed_correlation=rho,reconstructed_vif=vif)
}
bodytext<-paste(deparse(body(limma:::camera.default)),collapse='\n')
stopifnot(grepl('df.camera <- G - 2L',bodytext,fixed=TRUE),grepl('df.camera <- min(df.residual, G - 2L)',bodytext,fixed=TRUE))
result<-list(state='implementation_checks_passed',limma_version=as.character(packageVersion('limma')),profiles=9,blocks=3,design_rank=5,residual_df=4,mapped_oxphos_genes=182,voom_weights_preserved=TRUE,normalization_formula_verified=TRUE,contrast_and_residual_checks=audit,parametric_camera_reference_df=list(estimated=4,fixed_0.01=nrow(v$E)-2),interpretation='Correlations are computed from standardized weighted residual coordinates after fitting all block and condition terms, not from raw between-condition expression. These residuals cannot identify biological versus technical causes. Estimated versus fixed CAMERA also changes the reference degrees of freedom in this limma version.')
write_json(result,'provenance/camera_implementation_audit_2026-10-10.json',pretty=TRUE,auto_unbox=TRUE)
capture.output(limma:::camera.default,file='provenance/camera_default_3.68.5_audited.txt')
cat('Implementation checks and all three residual-correlation reconstructions passed.\n')
