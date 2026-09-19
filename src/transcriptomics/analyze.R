# Primary analysis: refuses to run without a verified pre-results freeze.
.libPaths(c(normalizePath('.Rlib'),.libPaths()))
suppressPackageStartupMessages({library(DESeq2);library(fgsea);library(jsonlite);library(ggplot2);library(digest)})
source('src/transcriptomics/helpers.R')
if(!file.exists('provenance/analysis_freeze.json')) stop('Freeze missing')
freeze <- fromJSON('provenance/analysis_freeze.json')
for(p in names(freeze$sha256)) if(digest(file=p,algo='sha256')!=freeze$sha256[[p]]) stop(paste('Frozen input changed:',p))
cfg<-fromJSON('config/analysis.yaml',simplifyVector=FALSE)
gs<-fromJSON('config/gene_sets.yaml',simplifyVector=FALSE)
paths<-setNames(lapply(gs$sets,function(x)unlist(x$genes)),vapply(gs$sets,`[[`,'','id'))
tiers<-setNames(vapply(gs$sets,`[[`,'','tier'),names(paths))
set.seed(cfg$seed)
for(d in c('tables/transcriptomics','figures/transcriptomics','data/processed/schmidt/models')) dir.create(d,recursive=TRUE,showWarnings=FALSE)
wt<-function(x,p) write.csv(x,p,row.names=FALSE,na='')
ct<-as.matrix(read.delim('data/processed/schmidt/core_block_condition_counts.tsv.gz',row.names=1,check.names=FALSE))
md<-read.csv('metadata/schmidt_analysis_units.csv');rownames(md)<-md$analysis_unit;md<-md[colnames(ct),]
core<-read.csv('metadata/schmidt_core_samples.csv');rownames(core)<-core$ODCF_name
ann<-read.csv('metadata/schmidt_gene_annotation.csv',stringsAsFactors=FALSE)
md$condition<-factor(md$condition,levels=unlist(cfg$condition_levels));md$block<-factor(md$block)
keep<-rowSums(ct>=cfg$minimum_count)>=cfg$minimum_samples
ct<-ct[keep,,drop=FALSE]
# Fix symbol representative by expression only, before estimating contrasts.
pre<-estimateSizeFactors(DESeqDataSetFromMatrix(ct,md,~block+condition))
means<-rowMeans(counts(pre,normalized=TRUE))
mapping<-data.frame(gene_id=rownames(ct),symbol=ann$name[match(rownames(ct),ann$gene_id)],mean_normalized_count=means)
mapping<-mapping[order(-mapping$mean_normalized_count,mapping$gene_id),]
mapping$selected<-!is.na(mapping$symbol)&nzchar(mapping$symbol)&!duplicated(mapping$symbol)
wt(mapping,'tables/transcriptomics/gene_mapping.csv')
selected<-mapping[mapping$selected,]; ids<-selected$gene_id; symbols<-selected$symbol
all_enrich<-list(); all_ranks<-list(); diagnostics<-list(); fits<-list()
fg<-function(rank,variant,contrast,kind='Wald') {
  set.seed(cfg$seed)
  a<-cfg$fgsea
  res<-fgseaMultilevel(pathways=paths,stats=rank,minSize=a$minSize,maxSize=a$maxSize,
     eps=a$eps,nPermSimple=a$nPermSimple,sampleSize=a$sampleSize,scoreType=a$scoreType,gseaParam=a$gseaParam,nproc=a$nproc)
  res<-as.data.frame(res);res$leadingEdge<-vapply(res$leadingEdge,paste,collapse=';',character(1))
  # Retain untestable sets as explicit rows, preserving the planned family size.
  res<-merge(data.frame(pathway=names(paths)),res,by='pathway',all.x=TRUE,sort=FALSE)
  res$tier<-unname(tiers[res$pathway]);res$variant<-variant;res$contrast<-contrast;res$rank_kind<-kind
  res$fgsea_internal_padj<-res$padj;res$padj<-NULL
  res$ranked_genes<-length(rank);res$rank_ties<-sum(duplicated(rank))
  res
}
run<-function(count,meta,variant,formula=~block+condition) {
  meta$block<-droplevels(factor(meta$block));meta$condition<-factor(meta$condition,levels=unlist(cfg$condition_levels))
  mat<-assert_design(meta,formula)
  d<-DESeqDataSetFromMatrix(count,meta,formula)
  # Disable automatic count replacement: observations are pooled biological groups.
  d<-DESeq(d,quiet=TRUE,minReplicatesForReplace=Inf)
  saveRDS(d,paste0('data/processed/schmidt/models/',variant,'.rds'))
  fits[[variant]]<<-d
  diagnostics[[variant]]<<-data.frame(variant=variant,n=ncol(d),genes=nrow(d),rank=ncol(mat),residual_df=nrow(mat)-ncol(mat),formula=paste(deparse(formula),collapse=''))
  for(nm in names(cfg$contrasts)) {
    pair<-unlist(cfg$contrasts[[nm]])
    r<-as.data.frame(results(d,contrast=c('condition',pair),independentFiltering=FALSE,alpha=cfg$alpha))
    r$gene_id<-rownames(r);r$symbol<-ann$name[match(r$gene_id,ann$gene_id)]
    wt(r,paste0('tables/transcriptomics/',variant,'_',nm,'_genes.csv'))
    ranks<-make_rank(r[ids,'stat'],symbols)
    wt(data.frame(symbol=names(ranks),statistic=unname(ranks)),paste0('tables/transcriptomics/',variant,'_',nm,'_ranks.csv'))
    all_ranks[[paste(variant,nm,sep=':')]]<<-ranks
    all_enrich[[paste(variant,nm,sep=':')]]<<-fg(ranks,variant,nm)
  }
}
run(ct,md,'primary')
for(b in levels(md$block)) {ix<-md$block!=b;run(ct[,ix],md[ix,],paste0('omit_',b))}
md_rin<-md;md_rin$RIN_centered<-md_rin$RIN_mean-mean(md_rin$RIN_mean)
run(ct,md_rin,'RIN_covariate',~block+RIN_centered+condition)
files<-sort(list.files('data/raw/schmidt/github/raw_data/IlseID29538/featureCounts',full.names=TRUE,pattern='\\.tsv$'))
raw<-sapply(files,function(p){t<-read.delim(p);setNames(t$num_reads,t$gene_id)})
colnames(raw)<-sub('_OE.*','',basename(files));raw<-raw[rownames(ct),core$ODCF_name]
pool<-function(meta) {
  z<-sapply(rownames(md),function(u){s<-meta$ODCF_name[meta$analysis_unit==u];if(!length(s))stop('Empty sensitivity group');rowSums(raw[,s,drop=FALSE])})
  rownames(z)<-rownames(ct);z
}
run(pool(core[core$RIN>=6,]),md,'RIN_ge6')
first<-core[order(core$ODCF_name),];first<-first[!duplicated(first$analysis_unit),]
wt(first,'tables/transcriptomics/first_library_selection.csv')
run(pool(first),md,'one_library_per_group')
# Descriptive per-block ranks use fixed primary normalization and symbol mapping.
norm<-counts(fits$primary,normalized=TRUE)
block_effects<-list()
for(b in levels(md$block)) for(nm in names(cfg$contrasts)) {
  pair<-unlist(cfg$contrasts[[nm]]);i<-which(md$block==b&md$condition==pair[1]);j<-which(md$block==b&md$condition==pair[2])
  effect<-log2(norm[ids,i]+1)-log2(norm[ids,j]+1)
  rank<-make_rank(effect,symbols)
  all_enrich[[paste(b,nm,sep=':')]]<-fg(rank,paste0('block_',b),nm,'descriptive normalized log ratio')
  block_effects[[paste(b,nm,sep=':')]]<-data.frame(block=b,contrast=nm,symbol=symbols,log2_normalized_ratio=effect)
}
be<-do.call(rbind,block_effects);wt(be,'tables/transcriptomics/per_block_gene_directions.csv')
res<-do.call(rbind,all_enrich);res$family_fdr<-NA_real_
for(v in unique(res$variant))for(t in unique(res$tier)) {
  ix<-res$variant==v&res$tier==t;n<-sum(tiers==t)*length(cfg$contrasts)
  res$family_fdr[ix]<-family_bh(res$pval[ix],n)
}
# Per-block competitive p values are retained but explicitly not biological p values.
wt(res,'tables/transcriptomics/enrichment_all.csv')
main<-res[res$variant=='primary',];main$robustness<-''
robust_details<-list();score_rows<-list()
for(i in seq_len(nrow(main))) {
  r<-main[i,];sub<-res[res$pathway==r$pathway&res$contrast==r$contrast,]
  block<-sub$NES[grepl('^(omit_|block_)',sub$variant)]
  technical<-sub$NES[sub$variant %in% c('RIN_covariate','RIN_ge6','one_library_per_group')]
  main$robustness[i]<-if(is.finite(r$NES)) classify_robustness(r$family_fdr,r$NES,block,technical) else 'unsupported'
  edge<-if(is.na(r$leadingEdge)) character(0) else strsplit(r$leadingEdge,';',fixed=TRUE)[[1]]
  for(b in levels(md$block)) {
    x<-be[be$block==b&be$contrast==r$contrast&be$symbol %in% edge,]
    robust_details[[paste(i,b)]]<-data.frame(pathway=r$pathway,contrast=r$contrast,block=b,leading_edge_genes=nrow(x),mean_leading_edge_log_ratio=mean(x$log2_normalized_ratio),fraction_same_gene_direction=mean(sign(x$log2_normalized_ratio)==sign(r$NES)))
  }
  # Whole-set mean normalized log ratio, equal biological-block weighting.
  vals<-vapply(levels(md$block),function(b)mean(be$log2_normalized_ratio[be$block==b&be$contrast==r$contrast&be$symbol %in% paths[[r$pathway]]]),numeric(1))
  flips<-as.matrix(expand.grid(rep(list(c(-1,1)),length(vals))))
  p<-mean(abs(as.vector(flips%*%vals)/length(vals))>=abs(mean(vals))-1e-12)
  score_rows[[i]]<-data.frame(pathway=r$pathway,contrast=r$contrast,block_equal_mean_log_ratio=mean(vals),block_sign_flip_p=p,minimum_attainable_two_sided_p=.25)
}
wt(main,'tables/transcriptomics/enrichment_primary_model.csv')
wt(do.call(rbind,robust_details),'tables/transcriptomics/leading_edge_block_directions.csv')
wt(do.call(rbind,score_rows),'tables/transcriptomics/block_score_sign_flips.csv')
wt(do.call(rbind,diagnostics),'tables/transcriptomics/model_diagnostics.csv')
# Jaccard overlap of frozen memberships and observed primary leading edges.
overlap<-list();pp<-combn(names(paths)[tiers=='primary'],2)
for(k in seq_len(ncol(pp))) {
 a<-pp[1,k];b<-pp[2,k]
 overlap[[k]]<-data.frame(pathway_a=a,pathway_b=b,shared=length(intersect(paths[[a]],paths[[b]])),jaccard=length(intersect(paths[[a]],paths[[b]]))/length(union(paths[[a]],paths[[b]])))
}
wt(do.call(rbind,overlap),'tables/transcriptomics/primary_membership_overlap.csv')
plot<-main[main$tier=='primary',];plot$label<-gsub('HALLMARK_','',plot$pathway)
g<-ggplot(plot,aes(contrast,label,fill=NES))+geom_tile(color='white')+geom_text(aes(label=sprintf('%.2f\nq=%.3g',NES,family_fdr)),size=3)+
 scale_fill_gradient2(low='#2166ac',mid='white',high='#b2182b',midpoint=0)+theme_minimal()+labs(x=NULL,y=NULL,title='Primary metabolic/redox anchors',subtitle='Blocked common-reference model; BH across 15 tests; NES is enrichment, not pathway flux')+theme(axis.text.x=element_text(angle=15,hjust=1))
ggsave('figures/transcriptomics/primary_enrichment.pdf',g,width=11,height=5)
ggsave('figures/transcriptomics/primary_enrichment.png',g,width=11,height=5,dpi=160)
g2<-ggplot(res[res$tier=='primary',],aes(variant,NES,color=contrast,group=contrast))+geom_hline(yintercept=0,color='grey70')+geom_point()+geom_line()+facet_wrap(~pathway,scales='free_y',ncol=2)+theme_bw()+theme(axis.text.x=element_text(angle=65,hjust=1,size=7))+labs(x=NULL,title='Direction and sensitivity across all frozen analyses')
ggsave('figures/transcriptomics/robustness.pdf',g2,width=13,height=10)
capture.output(sessionInfo(),file='provenance/analysis_r_session_info.txt')
write_json(list(completed_utc=format(Sys.time(),tz='UTC',usetz=TRUE),genes_after_count_filter=nrow(ct),symbols_rank_candidates=length(ids),sets=length(paths),primary_tests=15,seed=cfg$seed),'tables/transcriptomics/run_summary.json',auto_unbox=TRUE,pretty=TRUE)
