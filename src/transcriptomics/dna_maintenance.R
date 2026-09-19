# Post hoc, locally specified follow-up. Existing ranks only; original outputs unchanged.
.libPaths(c(normalizePath('.Rlib'), .libPaths()))
suppressPackageStartupMessages({library(fgsea);library(jsonlite);library(digest)})
source('src/transcriptomics/helpers.R')
for(record in c('provenance/analysis_freeze.json','provenance/dna_maintenance_freeze_v1.json')) {
 f<-fromJSON(record)
 for(p in names(f$sha256)) if(digest(file=p,algo='sha256')!=f$sha256[[p]]) stop(paste('Freeze changed:',p))
}
cfg<-fromJSON('config/dna_maintenance_v1.json',simplifyVector=FALSE)
for(p in names(cfg$source_checksums)) if(digest(file=p,algo='sha256')!=cfg$source_checksums[[p]])stop(paste('Source changed',p))
out<-'tables/dna_maintenance';dir.create(out,recursive=TRUE,showWarnings=FALSE)
be<-read.csv('tables/transcriptomics/per_block_gene_directions.csv')
variants<-c('primary',paste0('omit_',sort(unique(be$block))),'RIN_covariate','RIN_ge6','one_library_per_group',paste0('block_',sort(unique(be$block))))
rows<-list();k<-0;warn<-character()
for(v in variants)for(co in unlist(cfg$contrasts)){
 isblock<-startsWith(v,'block_')
 if(isblock){b<-be[be$block==sub('block_','',v)&be$contrast==co,];rank<-make_rank(b$log2_normalized_ratio,b$symbol)}else{
 r<-read.csv(paste0('tables/transcriptomics/',v,'_',co,'_ranks.csv'));rank<-make_rank(r$statistic,r$symbol)}
 for(m in cfg$modules){
  members<-unlist(m$genes);n<-sum(members%in%names(rank))
  z<-data.frame(module=m$id,kind=m$kind,contrast=co,variant=v,mapped=n,total=length(members),ranked_genes=length(rank),rank_ties=sum(duplicated(rank)),NES=NA_real_,ES=NA_real_,pval=NA_real_,leadingEdge='',log2err=NA_real_)
  if(n>=cfg$minSize&&n<=cfg$maxSize){set.seed(cfg$seed)
   a<-withCallingHandlers(fgseaMultilevel(setNames(list(members),m$id),rank,minSize=cfg$minSize,maxSize=cfg$maxSize,eps=cfg$eps,nPermSimple=cfg$nPermSimple,sampleSize=cfg$sampleSize,scoreType='std',gseaParam=1,nproc=1),warning=function(w){warn<<-c(warn,paste(v,co,m$id,conditionMessage(w),sep=' | '));invokeRestart('muffleWarning')})
   if(nrow(a)!=1)stop('Unexpected enrichment cardinality')
   z$NES<-a$NES;z$ES<-a$ES;z$pval<-a$pval;z$leadingEdge<-paste(a$leadingEdge[[1]],collapse=';');z$log2err<-a$log2err
  }
  k<-k+1;rows[[k]]<-z
 }
 message(v,' ',co,' complete')
}
x<-do.call(rbind,rows);x$family_fdr<-NA_real_
for(v in variants){i<-x$variant==v;if(!startsWith(v,'block_'))x$family_fdr[i]<-family_bh(x$pval[i],cfg$BH_tests)}
main<-x[x$variant=='primary',];main$robustness<-''
for(i in seq_len(nrow(main))){a<-main[i,];s<-x[x$module==a$module&x$contrast==a$contrast,];main$robustness[i]<-if(is.finite(a$NES))classify_robustness(a$family_fdr,a$NES,s$NES[grepl('^(block_|omit_)',s$variant)],s$NES[s$variant%in%c('RIN_covariate','RIN_ge6','one_library_per_group')])else 'untestable'}
write.csv(x,paste0(out,'/all_tests.csv'),row.names=FALSE,na='')
write.csv(main,paste0(out,'/primary_tests.csv'),row.names=FALSE,na='')
writeLines(warn,'provenance/dna_maintenance_warnings.txt')
capture.output(sessionInfo(),file='provenance/dna_maintenance_session.txt')
print(main[,c('module','contrast','mapped','NES','family_fdr','robustness')])
