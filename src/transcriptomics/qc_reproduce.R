# Run from repository root. Technical QC and original-model reproduction only.
.libPaths(c(normalizePath('.Rlib'), .libPaths()))
suppressPackageStartupMessages({library(DESeq2); library(ggplot2); library(jsonlite)})
set.seed(104006)
dir.create('data/interim/schmidt/reference',recursive=TRUE,showWarnings=FALSE)
for (d in c('tables/qc','tables/reproduction','figures/qc')) dir.create(d,recursive=TRUE,showWarnings=FALSE)
write_table <- function(x,p) write.csv(x,p,row.names=FALSE,na='')
reference <- readRDS('data/raw/schmidt/github/data/001_dds.rds')
meta <- as.data.frame(colData(reference)); meta$sample_id <- rownames(meta)
write_table(meta,'data/interim/schmidt/reference/rds_coldata.csv')
files <- sort(list.files('data/raw/schmidt/github/raw_data/IlseID29538/featureCounts',full.names=TRUE,pattern='\\.tsv$'))
tabs <- lapply(files,read.delim,check.names=FALSE)
stopifnot(all(vapply(tabs,function(x) identical(x$gene_id,tabs[[1]]$gene_id),logical(1))))
raw <- do.call(cbind,lapply(tabs,function(x) x$num_reads))
rownames(raw) <- tabs[[1]]$gene_id; colnames(raw) <- sub('_OE.*','',basename(files))
raw <- raw[,rownames(meta)]
stopifnot(all(raw>=0),all(raw==round(raw)),!anyDuplicated(rownames(raw)),identical(dim(raw[rowSums(raw)>0,]),dim(reference)))
stopifnot(identical(rownames(raw[rowSums(raw)>0,]),rownames(reference)),all(raw[rowSums(raw)>0,]==counts(reference)))
writeLines('Every cached count equals independently reconstructed source counts; all 43 library identities and gene ordering agree.','tables/reproduction/count_identity.txt')
core <- read.csv('metadata/schmidt_core_samples.csv',check.names=FALSE)
units <- read.csv('metadata/schmidt_analysis_units.csv',check.names=FALSE)
pooled <- as.matrix(read.delim('data/processed/schmidt/core_block_condition_counts.tsv.gz',row.names=1,check.names=FALSE))
rownames(units) <- units$analysis_unit; units <- units[colnames(pooled),]
qc <- function(ct,md,prefix) {
  md <- md[colnames(ct),,drop=FALSE]
  d <- DESeqDataSetFromMatrix(ct[rowSums(ct)>0,],md,~1)
  d <- estimateSizeFactors(d)
  # Blind VST estimates its own dispersions, independent of target hypotheses.
  v <- assay(vst(d,blind=TRUE)); norm <- counts(d,normalized=TRUE)
  sizes <- colSums(ct); detected <- colSums(ct>0)
  med <- median(log10(sizes)); scale <- mad(log10(sizes))
  q <- data.frame(sample_id=colnames(ct),library_counts=sizes,detected_genes=detected,
       size_factor=sizeFactors(d),log_library_mad=if(scale>0) abs(log10(sizes)-med)/scale else 0,
       stringsAsFactors=FALSE)
  q$review_flag <- q$log_library_mad>3 | q$library_counts<1e6 | q$detected_genes<10000
  write_table(q,paste0('tables/qc/',prefix,'_metrics.csv'))
  cr <- cor(v); write.csv(cr,paste0('tables/qc/',prefix,'_pearson.csv'))
  write.csv(cor(v,method='spearman'),paste0('tables/qc/',prefix,'_spearman.csv'))
  distances <- as.matrix(dist(t(v))); write.csv(distances,paste0('tables/qc/',prefix,'_distances.csv'))
  top <- order(apply(v,1,var),decreasing=TRUE)[seq_len(min(500,nrow(v)))]
  pc <- prcomp(t(v[top,])); pv <- 100*pc$sdev^2/sum(pc$sdev^2)
  coords <- cbind(data.frame(sample_id=colnames(v),PC1=pc$x[,1],PC2=pc$x[,2]),md[,setdiff(names(md),"sample_id"),drop=FALSE])
  write_table(coords,paste0('tables/qc/',prefix,'_pca.csv'))
  write_table(data.frame(PC=seq_along(pv),percent_variance=pv),paste0('tables/qc/',prefix,'_pca_variance.csv'))
  pdf(paste0('figures/qc/',prefix,'_qc.pdf'),width=11,height=8)
  for (field in intersect(c('condition','Condition_simple','Cell_line','Batch','RIN','RIN_mean'),names(coords))) {
    g <- ggplot(coords,aes(x=PC1,y=PC2,color=.data[[field]]))+geom_point(size=3)+
      labs(title=paste(prefix,'blind VST PCA —',field),x=sprintf('PC1 (%.1f%%)',pv[1]),y=sprintf('PC2 (%.1f%%)',pv[2]))+theme_bw()
    print(g)
    ggsave(paste0('figures/qc/',prefix,'_pca_',field,'.png'),g,width=8,height=5,dpi=130)
  }
  heatmap(distances,symm=TRUE,main=paste(prefix,'VST Euclidean distances'),margins=c(12,12),cexRow=.65,cexCol=.65)
  boxplot(log10(ct+1),outline=FALSE,las=2,cex.axis=.6,main=paste(prefix,'log10 raw counts + 1'))
  boxplot(log10(norm+1),outline=FALSE,las=2,cex.axis=.6,main=paste(prefix,'log10 normalized counts + 1'))
  dev.off()
  saveRDS(list(dds=d,vst=v),paste0('data/interim/schmidt/',prefix,'_qc.rds'))
  list(metrics=q,cor=cr,coords=coords)
}
rownames(core) <- core$ODCF_name
allqc <- qc(raw,meta,'all43')
coreqc <- qc(raw[,core$ODCF_name],core,'core23')
poolqc <- qc(pooled,units,'pooled9')
pairs <- combn(core$ODCF_name,2)
concordance <- do.call(rbind,lapply(seq_len(ncol(pairs)),function(i){
 a<-pairs[1,i]; b<-pairs[2,i]
 data.frame(sample_a=a,sample_b=b,block_a=core[a,'block'],block_b=core[b,'block'],
 condition_a=core[a,'condition'],condition_b=core[b,'condition'],
 same_analysis_unit=core[a,'analysis_unit']==core[b,'analysis_unit'],pearson_vst=coreqc$cor[a,b])}))
write_table(concordance,'tables/qc/core23_pair_concordance.csv')
# Refit published model unchanged, as a coding validation, not primary inference.
fresh <- DESeqDataSetFromMatrix(raw[rowSums(raw)>0,],meta,design(reference))
mcols(fresh)$gene_symbol <- tabs[[1]]$name[match(rownames(fresh),tabs[[1]]$gene_id)]
fresh <- DESeq(fresh,quiet=TRUE)
saveRDS(fresh,'data/interim/schmidt/reference/refitted_dds.rds')
contrasts <- list(day1_vs_control=c('Condition_simple','Trt5','Ctrl'),day3_vs_control=c('Condition_simple','Trt3','Ctrl'),day3_vs_day1=c('Condition_simple','Trt3','Trt5'))
summary_rows <- list(); representatives <- list()
for (nm in names(contrasts)) {
  a <- as.data.frame(results(reference,contrast=contrasts[[nm]],alpha=.05))
  b <- as.data.frame(results(fresh,contrast=contrasts[[nm]],alpha=.05))
  a$gene_id <- rownames(a); b$gene_id <- rownames(b)
  a$symbol <- mcols(reference)$gene_symbol; b$symbol <- mcols(fresh)$gene_symbol
  write_table(a,paste0('tables/reproduction/',nm,'_cached.csv'))
  write_table(b,paste0('tables/reproduction/',nm,'_refitted.csv'))
  sa <- !is.na(a$padj)&a$padj<.05; sb <- !is.na(b$padj)&b$padj<.05
  delta <- abs(a$log2FoldChange-b$log2FoldChange)
  summary_rows[[nm]] <- data.frame(contrast=nm,cached_deg=sum(sa),refit_deg=sum(sb),shared_deg=sum(sa&sb),
    cached_up=sum(sa&a$log2FoldChange>0),cached_down=sum(sa&a$log2FoldChange<0),
    lfc_pearson=cor(a$log2FoldChange,b$log2FoldChange,use='complete.obs'),
    median_abs_lfc_difference=median(delta,na.rm=TRUE),max_abs_lfc_difference=max(delta,na.rm=TRUE),
    sign_agreement=mean(sign(a$log2FoldChange)==sign(b$log2FoldChange),na.rm=TRUE))
  reps <- a[a$symbol %in% c('BDNF','NTRK2','FOS','EGR1','ARC','DLG4','SYN1'),]
  reps$contrast <- nm; representatives[[nm]]<-reps
}
write_table(do.call(rbind,summary_rows),'tables/reproduction/model_agreement.csv')
write_table(do.call(rbind,representatives),'tables/reproduction/representative_genes.csv')
write_json(list(cached_deseq2=as.character(metadata(reference)$version),current_deseq2=as.character(packageVersion('DESeq2')),
 raw_genes=nrow(raw),cached_genes=nrow(reference),libraries=ncol(raw),all_control_times_missing=all(is.na(meta$timepoint_d)),
 formula=paste(deparse(design(reference)),collapse='')), 'tables/reproduction/object_summary.json',pretty=TRUE,auto_unbox=TRUE)
capture.output(sessionInfo(),file='provenance/r_session_info.txt')
