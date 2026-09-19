source('src/figures/figure_style.R')
.libPaths(c(normalizePath('.Rlib'), .libPaths()))
suppressPackageStartupMessages({
  library(ComplexHeatmap)
  library(circlize)
  library(DESeq2)
  library(jsonlite)
  library(grid)
})

out_dir <- 'figures/transcriptomics'
dir.create(out_dir, showWarnings=FALSE, recursive=TRUE)

split_genes <- function(value) {
  if (is.na(value) || value == '') character() else strsplit(value, ';', fixed=TRUE)[[1]]
}
overlap <- read.csv('tables/transcriptomics/leading_edge_time_overlap.csv', check.names=FALSE)
overlap <- overlap[overlap$pathway == 'HALLMARK_OXIDATIVE_PHOSPHORYLATION', ]
shared <- split_genes(overlap$shared_genes)
day1_only <- split_genes(overlap$day1_only)
day3_only <- split_genes(overlap$day3_only)
genes <- c(shared, day1_only, day3_only)
stopifnot(length(genes) == 113L, length(shared) == 89L)

read_effect <- function(contrast) {
  x <- read.csv(sprintf('tables/transcriptomics/primary_%s_genes.csv', contrast))
  selected <- read.csv('tables/transcriptomics/gene_mapping.csv')
  x <- x[x$gene_id %in% selected$gene_id[selected$selected], c('symbol','log2FoldChange')]
  stopifnot(!anyDuplicated(x$symbol))
  setNames(x$log2FoldChange, x$symbol)
}
d1 <- read_effect('day1_vs_control')
d3 <- read_effect('day3_vs_control')
dt <- read_effect('day3_vs_day1')
effect_mat <- cbind(
  `D1/Ctrl`=d1[genes],
  `D3/Ctrl`=d3[genes],
  `D3/D1`=dt[genes])
rownames(effect_mat) <- genes
stopifnot(!anyNA(effect_mat))

# VST expression for the nine conservative biological block-by-condition profiles.
dds <- readRDS('data/processed/schmidt/models/primary.rds')
vst_mat <- assay(varianceStabilizingTransformation(dds, blind=FALSE))
mapping <- read.csv('tables/transcriptomics/gene_mapping.csv')
mapping <- mapping[mapping$selected & mapping$symbol %in% genes, c('gene_id','symbol')]
stopifnot(nrow(mapping) == length(genes), !anyDuplicated(mapping$symbol))
profile_mat <- vst_mat[mapping$gene_id, , drop=FALSE]
rownames(profile_mat) <- mapping$symbol
profile_mat <- profile_mat[genes, , drop=FALSE]
profile_z <- t(scale(t(profile_mat)))
profile_z[profile_z > 2.5] <- 2.5
profile_z[profile_z < -2.5] <- -2.5

annotations <- read.csv('config/oxphos_display_annotations.csv')
stopifnot(!anyDuplicated(annotations$gene), setequal(annotations$gene, genes))
group_levels <- c(
  'Respiratory complex I','Respiratory complex II','Respiratory complex III',
  'Respiratory complex IV','ATPase and ion transport',
  'Mitochondrial import and translation','TCA cycle and pyruvate metabolism',
  'Lipid oxidation and electron transfer','Other OXPHOS-set genes')
group <- factor(annotations$functional_group[match(genes, annotations$gene)], levels=group_levels)
edge_membership <- factor(
  ifelse(genes %in% shared, 'Shared', ifelse(genes %in% day1_only, 'Day 1 only', 'Day 3 only')),
  levels=c('Shared','Day 1 only','Day 3 only'))

cfg <- fromJSON('config/gene_sets.yaml', simplifyVector=FALSE)
membership <- setNames(lapply(cfg$sets, function(z) unlist(z$genes, use.names=FALSE)),
                       vapply(cfg$sets, function(z) z$id, character(1)))
tracks <- data.frame(
  ROS=genes %in% membership[['HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY']],
  Glycolysis=genes %in% membership[['HALLMARK_GLYCOLYSIS']],
  `PI3K–mTOR`=genes %in% membership[['HALLMARK_PI3K_AKT_MTOR_SIGNALING']],
  `Resp. ET`=genes %in% membership[['REACTOME_RESPIRATORY_ELECTRON_TRANSPORT']],
  Mitophagy=genes %in% membership[['REACTOME_MITOPHAGY']],
  check.names=FALSE)

# Order without unsupervised clustering: biological function, leading-edge membership, mean effect.
ord <- order(group, edge_membership, -rowMeans(effect_mat[, 1:2, drop=FALSE]))
genes <- genes[ord]
group <- group[ord]
edge_membership <- edge_membership[ord]
tracks <- tracks[ord, , drop=FALSE]
profile_z <- profile_z[genes, , drop=FALSE]
effect_mat <- effect_mat[genes, , drop=FALSE]

# Explicit keyed column order: never assign profile labels by inherited RDS position.
cd <- as.data.frame(colData(dds))
block_ids <- c('68_3__batch1','68_3__batch2','69_2__batch1')
condition_ids <- c('control','psilocin_day1','psilocin_day3')
keys <- paste(cd$block, cd$condition, sep='::')
expected <- as.vector(t(outer(block_ids, condition_ids, paste, sep='::')))
stopifnot(!anyDuplicated(keys), setequal(keys, expected),
          identical(colnames(profile_z), rownames(cd)))
column_order <- match(expected, keys)
cd <- cd[column_order, , drop=FALSE]
profile_mat <- profile_mat[, column_order, drop=FALSE]
profile_z <- profile_z[, column_order, drop=FALSE]
stopifnot(identical(paste(cd$block, cd$condition, sep='::'), expected))
condition <- factor(cd$condition, levels=condition_ids,
                    labels=c('Control','Day 1','Day 3'))
block <- factor(cd$block, levels=block_ids,
                labels=c('68_3 / B1','68_3 / B2','69_2 / B1'))
colnames(profile_z) <- rep(c('Ctrl','D1','D3'), 3)

# Descriptive export used by the static explorer. No inferential model is refitted.
profile_export <- data.frame(gene=rep(genes, each=9),
  profile_id=rep(rownames(cd), times=length(genes)),
  block=rep(as.character(block), times=length(genes)),
  condition=rep(as.character(condition), times=length(genes)),
  vst=as.vector(t(profile_mat[genes, , drop=FALSE])),
  row_z=as.vector(t(t(scale(t(profile_mat[genes, , drop=FALSE]))))),
  RIN_mean=rep(cd$RIN_mean, times=length(genes)),
  libraries_n=rep(cd$libraries_n, times=length(genes)))
write.csv(profile_export, 'tables/transcriptomics/oxphos_display_profiles.csv', row.names=FALSE)

font <- figure_style$font
top_ha <- HeatmapAnnotation(
  RIN=anno_points(cd$RIN_mean, ylim=c(5,10), size=unit(1,'mm'),
       axis_param=list(side='right',at=c(5,10), gp=gpar(fontsize=8)), gp=gpar(col='#333333')),
  Libraries=anno_barplot(cd$libraries_n, ylim=c(0,3.5),
       axis_param=list(side='right',at=c(0,3), gp=gpar(fontsize=8)), gp=gpar(fill='#667982',col=NA)),
  annotation_name_gp=gpar(fontsize=8), annotation_name_side='right',annotation_name_rot=0,
  annotation_name_offset=unit(5,'mm'),
  height=unit(16,'mm'))

binary_colors <- c('FALSE'='#eeeeee', 'TRUE'='#49585e')
left_ha <- rowAnnotation(
  LE=edge_membership, ROS=tracks$ROS, Gly=tracks$Glycolysis,
  PI3K=tracks[['PI3K–mTOR']], ET=tracks[['Resp. ET']], Mito=tracks$Mitophagy,
  col=list(LE=c(Shared='#222222', `Day 1 only`='#56b4e9', `Day 3 only`='#d55e00'),
           ROS=binary_colors,Gly=binary_colors,PI3K=binary_colors,ET=binary_colors,Mito=binary_colors),
  show_legend=FALSE, annotation_name_side='top', annotation_name_rot=90,
  annotation_name_offset=unit(4,'mm'),
  annotation_name_gp=gpar(fontsize=8), simple_anno_size=unit(2.4,'mm'))
short_groups <- c('Complex I','Complex II','Complex III','Complex IV',
                  'ATPase / ion\ntransport','Import /\ntranslation','TCA / pyruvate',
                  'Lipid oxidation /\nelectron transfer','Other OXPHOS')
profile_ht <- Heatmap(profile_z, name='Row z-score',
  col=colorRamp2(c(-2.5,0,2.5),c('#3b6fb6','white','#d55e00')),
  cluster_rows=FALSE, cluster_columns=FALSE, cluster_row_slices=FALSE,
  row_split=group, row_gap=unit(1.3,'mm'),
  column_split=block, cluster_column_slices=FALSE, column_gap=unit(2,'mm'),
  column_title=levels(block), column_title_gp=gpar(fontsize=8,fontface='bold'),
  show_row_names=FALSE, show_column_names=TRUE,
  column_names_gp=gpar(fontsize=8), column_names_rot=0,
  rect_gp=gpar(col=NA), border=TRUE,
  top_annotation=top_ha, left_annotation=left_ha,
  row_title=short_groups, row_title_gp=gpar(fontsize=8,fontface='bold'),
  row_title_rot=0, row_title_side='left', width=unit(54,'mm'),
  heatmap_legend_param=list(direction='horizontal',legend_width=unit(32,'mm'),
    at=c(-2.5,0,2.5),labels=c('−2.5','0','2.5'),
    title_gp=gpar(fontsize=8,fontface='bold'),labels_gp=gpar(fontsize=8)))
effect_ht <- Heatmap(effect_mat, name='log2 fold change',
  col=colorRamp2(c(-1.5,0,1.5),c('#3b6fb6','white','#d55e00')),
  cluster_rows=FALSE,cluster_columns=FALSE,row_split=group,row_gap=unit(1.3,'mm'),
  cluster_row_slices=FALSE,show_row_names=FALSE,
  show_column_names=TRUE,column_names_gp=gpar(fontsize=8),column_names_rot=45,
  column_title='Model effects',column_title_gp=gpar(fontsize=8,fontface='bold'),
  rect_gp=gpar(col=NA),border=TRUE,width=unit(24,'mm'),
  heatmap_legend_param=list(direction='horizontal',legend_width=unit(32,'mm'),
    at=c(-1.5,0,1.5),labels=c('−1.5','0','1.5'),
    title_gp=gpar(fontsize=8,fontface='bold'),labels_gp=gpar(fontsize=8)))
representative_genes <- c('NDUFB7','SDHB','CYC1','COX8A','ATP6V0C','TIMM13','OGDH','GPX4')
stopifnot(all(representative_genes %in% genes))
label_idx <- which(genes %in% representative_genes)
marks <- rowAnnotation(gene=anno_mark(at=label_idx,labels=genes[label_idx],
  labels_gp=gpar(fontsize=8),link_gp=gpar(col='#777777',lwd=.6)),show_annotation_name=FALSE)
landscape <- profile_ht + effect_ht + marks
edge_legend <- Legend(title='Leading edge (LE)',labels=c('Shared','D1 only','D3 only'),
  legend_gp=gpar(fill=c('#222222','#56b4e9','#d55e00')),nrow=1,
  title_gp=gpar(fontsize=8,fontface='bold'),labels_gp=gpar(fontsize=8))
member_legend <- Legend(title='Pathway membership',labels=c('Absent','Present'),
  legend_gp=gpar(fill=binary_colors),nrow=1,
  title_gp=gpar(fontsize=8,fontface='bold'),labels_gp=gpar(fontsize=8))
draw_plot <- function() {
  pushViewport(viewport(gp=gpar(fontfamily=font)))
  draw(landscape, column_title='OXPHOS leading-edge landscape',
       column_title_gp=gpar(fontsize=10,fontface='bold'),
       heatmap_legend_side='bottom',annotation_legend_side='bottom',
       annotation_legend_list=list(edge_legend,member_legend),
       merge_legends=TRUE,legend_gap=unit(5,'mm'),newpage=FALSE,padding=unit(c(4,4,4,4),'mm'))
  popViewport()
}
cairo_pdf(file.path(out_dir,'oxphos_gene_landscape.pdf'),width=178/25.4,height=230/25.4,family=font)
draw_plot(); dev.off()
png(file.path(out_dir,'oxphos_gene_landscape.png'),width=178,height=230,units='mm',res=400,type='cairo',family=font)
draw_plot(); dev.off()
svg(file.path(out_dir,'oxphos_gene_landscape.svg'),width=178/25.4,height=230/25.4,family=font)
draw_plot(); dev.off()
export <- data.frame(gene=genes,functional_group=as.character(group),
  leading_edge=as.character(edge_membership),
  day1_log2fc=effect_mat[,1],day3_log2fc=effect_mat[,2],day3_minus_day1_log2fc=effect_mat[,3],
  annotation_source=annotations$annotation_source[match(genes,annotations$gene)],
  annotation_rule=annotations$annotation_rule[match(genes,annotations$gene)])
export[,names(tracks)] <- tracks
write.csv(export,'tables/transcriptomics/oxphos_leading_edge_function_map.csv',row.names=FALSE)
capture.output(sessionInfo(),file='provenance/figure_session_info.txt')
