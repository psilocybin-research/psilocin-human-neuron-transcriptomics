source('src/figures/figure_style.R')
.libPaths(c(normalizePath('.Rlib'), .libPaths()))
suppressPackageStartupMessages({
  library(ggplot2)
  library(jsonlite)
  library(patchwork)
})

update_geom_defaults('text',list(family=figure_style$font))
update_geom_defaults('label',list(family=figure_style$font))

dir.create('figures/transcriptomics', showWarnings=FALSE, recursive=TRUE)

pathway_labels <- c(
  HALLMARK_OXIDATIVE_PHOSPHORYLATION='Oxidative phosphorylation',
  HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY='Reactive oxygen species',
  HALLMARK_PI3K_AKT_MTOR_SIGNALING='PI3K–AKT–mTOR signaling',
  HALLMARK_GLYCOLYSIS='Glycolysis',
  HALLMARK_MTORC1_SIGNALING='mTORC1 signaling')
contrast_labels <- c(
  day1_vs_control='Day 1 / common control',
  day3_vs_control='Day 3 / common control',
  day3_vs_day1='Treated Day 3 / Day 1')
status_labels <- c(
  robust='robust',
  `block-dependent`='block-dependent',
  `directionally consistent but uncertain`='uncertain',
  unsupported='unsupported')

# Figure 1: retain every frozen primary result and show the evidence classification.
x <- read.csv('tables/transcriptomics/enrichment_primary_model.csv', check.names=FALSE)
x <- x[x$tier == 'primary', ]
x$pathway_label <- factor(pathway_labels[x$pathway], levels=rev(unname(pathway_labels)))
x$contrast_label <- factor(contrast_labels[x$contrast], levels=unname(contrast_labels))
x$status <- status_labels[x$robustness]
superscript_integer <- function(value) {
  glyphs <- c('-'='⁻','0'='⁰','1'='¹','2'='²','3'='³','4'='⁴',
              '5'='⁵','6'='⁶','7'='⁷','8'='⁸','9'='⁹')
  paste0(unname(glyphs[strsplit(as.character(value), '', fixed=TRUE)[[1]]]), collapse='')
}
format_q <- function(value) {
  if (value < .001) {
    exponent <- floor(log10(value))
    coefficient <- value / 10^exponent
    return(sprintf('%.1f×10%s', coefficient, superscript_integer(exponent)))
  }
  formatC(value, format='fg', digits=2)
}
x$q_label <- vapply(x$family_fdr, format_q, character(1))
x$label <- sprintf('NES %.2f\nq=%s\n%s', x$NES, x$q_label, x$status)

p1 <- ggplot(x, aes(contrast_label, pathway_label, fill=NES)) +
  geom_tile(color='white', linewidth=1.1) +
  geom_text(aes(label=label), size=3.2, lineheight=.94) +
  scale_fill_gradient2(low='#3b6fb6', mid='white', high='#d55e00', midpoint=0,
                       name='NES', limits=c(-2.6, 2.6)) +
  labs(
    x=NULL, y=NULL,
    title='Primary metabolic and redox pathway evidence',
    subtitle='Blocked model of nine profiles from three differentiation blocks',
    caption='q: Benjamini–Hochberg correction across all 15 primary tests') +
  theme_minimal(base_size=8.5, base_family=figure_style$font) +
  theme(
    panel.grid=element_blank(),
    plot.title=element_text(face='bold', size=10.5),
    plot.subtitle=element_text(size=8.2),
    plot.caption=element_text(hjust=0, size=8, color='grey30'),
    axis.text.x=element_text(size=8, margin=margin(t=4)),
    axis.text.y=element_text(size=8),
    legend.text=element_text(size=8),
    legend.position='right')

ggsave('figures/transcriptomics/primary_enrichment.pdf', p1, width=7.01, height=4.15, device=cairo_pdf)
ggsave('figures/transcriptomics/primary_enrichment.png', p1, width=7.01, height=4.15, dpi=400)
grDevices::svg('figures/transcriptomics/primary_enrichment.svg', width=7.01, height=4.15)
print(p1)
grDevices::dev.off()

# Figure 2A: weighted running-enrichment curves from the frozen literal-symbol ranks.
cfg <- fromJSON('config/gene_sets.yaml', simplifyVector=FALSE)
set_index <- which(vapply(cfg$sets, function(z) z$id, character(1)) ==
                   'HALLMARK_OXIDATIVE_PHOSPHORYLATION')
oxphos <- unlist(cfg$sets[[set_index]]$genes, use.names=FALSE)

running_curve <- function(contrast) {
  rank <- read.csv(sprintf('tables/transcriptomics/primary_%s_ranks.csv', contrast))
  rank <- rank[order(-rank$statistic, rank$symbol), ]
  hit <- rank$symbol %in% oxphos
  hit_weight <- abs(rank$statistic) * hit
  hit_step <- hit_weight / sum(hit_weight)
  miss_step <- (!hit) / sum(!hit)
  data.frame(
    rank_fraction=seq_len(nrow(rank)) / nrow(rank),
    running_ES=cumsum(hit_step - miss_step),
    hit=hit,
    contrast=contrast_labels[[contrast]])
}
curve <- do.call(rbind, lapply(c('day1_vs_control', 'day3_vs_control'), running_curve))
curve$contrast <- factor(curve$contrast, levels=unname(contrast_labels[1:2]))

p2a <- ggplot(curve, aes(rank_fraction * 100, running_ES)) +
  geom_hline(yintercept=0, linewidth=.35, color='grey65') +
  geom_line(linewidth=.35, color='#b23a48') +
  geom_rug(data=curve[curve$hit, ], sides='b', alpha=.16, linewidth=.22, color='#2b6f8a') +
  facet_wrap(~contrast, ncol=1) +
  scale_x_continuous(labels=function(z) paste0(z, '%'), breaks=c(0,25,50,75,100)) +
  labs(
    x='Position in ranked transcriptome', y='Running enrichment score',
    title='Weighted running enrichment') +
  theme_bw(base_size=8, base_family=figure_style$font) +
  theme(
    axis.text=element_text(size=8), legend.text=element_text(size=8),
    panel.grid.minor=element_blank(),
    strip.background=element_rect(fill='#f0f3f5', color='#c9d0d4'),
    strip.text=element_text(face='bold',size=8),
    plot.title=element_text(face='bold', size=8.5))

# Figure 2B: show the three biological blocks rather than another inferential p-value.
b <- read.csv('tables/transcriptomics/leading_edge_block_directions.csv')
b <- b[b$pathway == 'HALLMARK_OXIDATIVE_PHOSPHORYLATION', ]
b$contrast_label <- factor(contrast_labels[b$contrast], levels=unname(contrast_labels))
b$contrast_short <- factor(
  b$contrast,
  levels=c('day1_vs_control','day3_vs_control','day3_vs_day1'),
  labels=figure_style$effect_labels)
b$block_label <- factor(
  b$block,
  levels=c('68_3__batch1','68_3__batch2','69_2__batch1'),
  labels=c('68_3 / B1','68_3 / B2','69_2 / B1'))

p2b <- ggplot(b, aes(contrast_short, mean_leading_edge_log_ratio,
                     color=block_label, shape=block_label)) +
  geom_hline(yintercept=0, linewidth=.45, color='grey50') +
  geom_point(size=2.7, position=position_dodge(width=.45)) +
  scale_color_manual(values=c('#0072b2','#56b4e9','#d55e00'), name='Biological block') +
  scale_shape_manual(values=c(16,17,15), name='Biological block') +
  scale_y_continuous(expand=expansion(mult=c(.12,.15))) +
  labs(
    x=NULL, y='Mean leading-edge log2 expression ratio',
    title='Descriptive block directions') +
  theme_bw(base_size=8, base_family=figure_style$font) +
  theme(
    axis.text=element_text(size=8), legend.text=element_text(size=8),
    panel.grid.minor=element_blank(),
    axis.text.x=element_text(angle=0, hjust=.5, size=8),
    legend.position='bottom',
    legend.title=element_blank(),
    plot.title=element_text(face='bold', size=8.5))

p2 <- (p2a | p2b) +
  plot_layout(widths=c(1.05, 1)) +
  plot_annotation(
    title='Day-versus-control OXPHOS enrichment is broad and directionally consistent across blocks',
    subtitle='Leading edges: 95 genes at Day 1 and 107 at Day 3, with 89 shared',
    tag_levels='a',
    theme=theme(
      text=element_text(family=figure_style$font),
      plot.tag=element_text(face='bold',size=8),
      plot.title=element_text(face='bold', size=10.5),
      plot.subtitle=element_text(size=8.2)))

ggsave('figures/transcriptomics/oxphos_evidence.pdf', p2, width=7.01, height=4.8, device=cairo_pdf)
ggsave('figures/transcriptomics/oxphos_evidence.png', p2, width=7.01, height=4.8, dpi=400)
grDevices::svg('figures/transcriptomics/oxphos_evidence.svg', width=7.01, height=4.8)
print(p2)
grDevices::dev.off()

# Supplementary Figure 1: explicit post-freeze symbol-mapping sensitivity.
a <- read.csv('tables/oxphos_alias/all_variants.csv')
variant_labels <- c(
  primary='All 3 blocks',
  omit_68_3__batch1='Omit 68_3 / block 1',
  omit_68_3__batch2='Omit 68_3 / block 2',
  omit_69_2__batch1='Omit 69_2 / block 1',
  RIN_covariate='Adjust for pooled RIN',
  RIN_ge6='Exclude RIN < 6',
  one_library_per_group='One library per group',
  block_68_3__batch1='68_3 / block 1 only',
  block_68_3__batch2='68_3 / block 2 only',
  block_69_2__batch1='69_2 / block 1 only')
stopifnot(nrow(a) == 30L, setequal(unique(a$variant), names(variant_labels)))
a$variant_label <- factor(variant_labels[a$variant], levels=rev(unname(variant_labels)))
a$contrast_label <- factor(a$contrast, levels=names(contrast_labels), labels=unname(contrast_labels))

p3 <- ggplot(a, aes(y=variant_label)) +
  geom_vline(xintercept=0, color='grey55', linewidth=.35) +
  geom_segment(aes(x=baseline_NES, xend=NES, yend=variant_label), color='grey65', linewidth=.7) +
  geom_point(aes(x=baseline_NES), shape=21, color='#256a80', fill='white', size=2.1, stroke=.9) +
  geom_point(aes(x=NES), shape=16, color='#a72f40', size=2.1) +
  facet_wrap(~contrast_label, nrow=1, scales='free_x') +
  scale_x_continuous(expand=expansion(mult=c(.06,.13))) +
  labs(
    x='OXPHOS normalized enrichment score (NES)', y=NULL,
    title='Verified gene aliases retain the OXPHOS pattern',
    subtitle='Open circles: frozen literal symbols (182); filled circles: HGNC alias sensitivity (198)') +
  theme_bw(base_size=8, base_family=figure_style$font) +
  theme(
    axis.text=element_text(size=8),strip.text=element_text(size=8),
    panel.grid.major.y=element_blank(), panel.grid.minor=element_blank(),
    strip.background=element_rect(fill='#f1f4f6', color='#d9e0e3'),
    plot.title=element_text(face='bold', size=10.5), axis.text.y=element_text(size=8),
    panel.spacing=grid::unit(1, 'lines'))

ggsave('figures/transcriptomics/oxphos_alias_sensitivity.pdf', p3, width=7.01, height=4.6, device=cairo_pdf)
ggsave('figures/transcriptomics/oxphos_alias_sensitivity.png', p3, width=7.01, height=4.6, dpi=400)
grDevices::svg('figures/transcriptomics/oxphos_alias_sensitivity.svg', width=7.01, height=4.6)
print(p3)
grDevices::dev.off()
