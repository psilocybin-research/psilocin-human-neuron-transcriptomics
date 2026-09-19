# Separate post-primary targeted tier; never modifies frozen primary outputs.
.libPaths(c(normalizePath('.Rlib'),.libPaths()))
suppressPackageStartupMessages({library(fgsea);library(jsonlite);library(digest)})
source('src/transcriptomics/helpers.R')
cfg<-fromJSON('config/targeted_redox_v1.json',simplifyVector=FALSE)
f<-fromJSON('provenance/targeted_redox_freeze_v1.json')
for(p in names(f$sha256))if(digest(file=p,algo='sha256')!=f$sha256[[p]])stop(paste('Target freeze changed',p))
f<-fromJSON('provenance/analysis_freeze.json')
for(p in names(f$sha256))if(digest(file=p,algo='sha256')!=f$sha256[[p]])stop(paste('Primary freeze changed',p))
out<-'tables/targeted_redox';dir.create(out,recursive=TRUE,showWarnings=FALSE)
map<-read.csv('tables/transcriptomics/gene_mapping.csv');map<-map[map$selected,];ids<-setNames(map$gene_id,map$symbol)
be<-read.csv('tables/transcriptomics/per_block_gene_directions.csv')
variants<-c('primary',paste0('omit_',sort(unique(be$block))),'RIN_covariate','RIN_ge6','one_library_per_group',paste0('block_',sort(unique(be$block))))
rows<-list();k<-0
for(v in variants)for(co in unlist(cfg$contrasts)){
 isblock<-startsWith(v,'block_')
 if(isblock){b<-be[be$block==sub('block_','',v)&be$contrast==co,];rank<-make_rank(b$log2_normalized_ratio,b$symbol)}else{
  r<-read.csv(paste0('tables/transcriptomics/',v,'_',co,'_ranks.csv'));rank<-make_rank(r$statistic,r$symbol)
  gene<-read.csv(paste0('tables/transcriptomics/',v,'_',co,'_genes.csv'));rownames(gene)<-gene$gene_id
 }
 for(m in cfg$modules){
  members<-unlist(m$genes);n<-sum(members%in%names(rank));coverage<-n/length(members)
  z<-data.frame(module=m$id,contrast=co,variant=v,method=m$method,mapped=n,total=length(members),coverage=coverage,estimate=NA_real_,pval=NA_real_,leadingEdge='',log2err=NA_real_)
  if(m$method=='gene_Wald'){
   if(isblock)z$estimate<-unname(rank['GPX4']) else {g<-gene[ids[['GPX4']],];z$estimate<-g$stat;z$pval<-g$pvalue}
   z$leadingEdge<-'GPX4'
  }else if(n>=cfg$minSize&&coverage>=cfg$min_coverage){
   set.seed(cfg$seed)
   a<-fgseaMultilevel(setNames(list(members),m$id),rank,minSize=cfg$minSize,maxSize=cfg$maxSize,eps=0,nPermSimple=10000,sampleSize=101,scoreType='std',gseaParam=1,nproc=1)
   z$estimate<-a$NES;z$pval<-a$pval;z$leadingEdge<-paste(a$leadingEdge[[1]],collapse=';');z$log2err<-a$log2err
  }
  k<-k+1;rows[[k]]<-z
 }
}
x<-do.call(rbind,rows);x$family_fdr<-NA_real_
for(v in variants){i<-x$variant==v;if(!startsWith(v,'block_'))x$family_fdr[i]<-family_bh(x$pval[i],cfg$BH_tests)}
main<-x[x$variant=='primary',];main$robustness<-'';main$predicted_positive_robust<-FALSE
for(i in seq_len(nrow(main))){a<-main[i,];s<-x[x$module==a$module&x$contrast==a$contrast,];
 main$robustness[i]<-if(is.finite(a$estimate))classify_robustness(a$family_fdr,a$estimate,s$estimate[grepl('^(block_|omit_)',s$variant)],s$estimate[s$variant%in%c('RIN_covariate','RIN_ge6','one_library_per_group')])else 'untestable'
 main$predicted_positive_robust[i]<-main$robustness[i]=='robust'&&is.finite(a$estimate)&&a$estimate>0
}
write.csv(x,paste0(out,'/all_tests.csv'),row.names=FALSE,na='');write.csv(main,paste0(out,'/primary_tests.csv'),row.names=FALSE,na='')
capture.output(sessionInfo(),file='provenance/targeted_redox_session.txt')
print(main[,c('module','contrast','mapped','estimate','family_fdr','robustness')])
capture.output(warnings(),file='provenance/targeted_redox_warnings.txt')
