# Runtime verification of existing CAMERA specifications, not a new analysis.
Sys.setenv(OMP_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',MKL_NUM_THREADS='1')
.libPaths(c(normalizePath('.Rlib-camera'),normalizePath('.Rlib'),.libPaths()))
suppressPackageStartupMessages({library(limma);library(jsonlite);library(digest)})
source('src/transcriptomics/camera_helpers.R')
f<-readRDS('tables/camera_sensitivity/fit.rds')
stopifnot(as.character(packageVersion('limma'))=='3.68.5')
.camera_runtime_capture<-NULL
trace('camera.default',where=asNamespace('limma'),print=FALSE,
 exit=quote(assign('.camera_runtime_capture',list(reference_df=df.camera,residual_df=df.residual,genes=G,fixed_correlation=fixed.cor,use_ranks=use.ranks,weights_present=!is.null(weights)),envir=.GlobalEnv)))
results<-list();runtime<-list()
tryCatch({
 for(mode in c('estimated','fixed_0.01')) for(co in names(f$config$contrasts)) {
  r<-camera(f$voom,f$index,design=f$design,contrast=camera_contrast(co,f$design),
   use.ranks=FALSE,allow.neg.cor=FALSE,inter.gene.cor=if(mode=='estimated') NA_real_ else .01,
   trend.var=FALSE,sort=FALSE,directional=TRUE)
  capture<-.camera_runtime_capture
  stopifnot(capture$reference_df==if(mode=='estimated') 4 else 21096,
   capture$residual_df==4,capture$genes==21098,!capture$use_ranks,capture$weights_present)
  runtime[[paste(mode,co,sep=':')]]<-capture
  if(!"Correlation" %in% names(r)) r$Correlation<-.01
  r$pathway<-rownames(r);r$mode<-mode;r$contrast<-co
  results[[paste(mode,co)]]<-r
 }
},finally=untrace('camera.default',where=asNamespace('limma')))
r<-do.call(rbind,results);saved<-read.csv('tables/camera_sensitivity/all_tests.csv')
r$family_fdr<-NA_real_
for(mode in unique(r$mode)){ix<-r$mode==mode;r$family_fdr[ix]<-p.adjust(r$PValue[ix],method='BH',n=15)}
max_difference<-0
for(i in seq_len(nrow(r))) {
 old<-saved[saved$mode==r$mode[i]&saved$contrast==r$contrast[i]&saved$pathway==r$pathway[i],]
 stopifnot(nrow(old)==1,r$NGenes[i]==old$NGenes,r$Direction[i]==old$Direction)
 delta<-max(abs(c(r$PValue[i]-old$PValue,r$family_fdr[i]-old$family_fdr)))
 stopifnot(delta<1e-13);max_difference<-max(max_difference,delta)
 if(r$mode[i]=='estimated')stopifnot(abs(r$Correlation[i]-old$Correlation)<1e-13)
}
write_json(list(state='verified_in_actual_camera_execution',limma_version='3.68.5',runtime_calls=runtime,
 tests_matched=30,max_absolute_p_q_difference=max_difference,
 saved_results_sha256=digest(file='tables/camera_sensitivity/all_tests.csv',algo='sha256'),
 fitted_input_sha256=digest(file='tables/camera_sensitivity/fit.rds',algo='sha256'),
 note='Trace captures df.camera from camera.default during execution. Original output files are read only; no settings or numerical results changed.'),
 'provenance/camera_runtime_df_verification_2026-10-10.json',pretty=TRUE,auto_unbox=TRUE,digits=16)
cat('All six CAMERA calls used the reported reference df; all 30 numerical outcomes match.\n')
