validate_camera_inputs <- function(ct, md, mapping, levels, expected_profiles=NULL) {
  if (anyDuplicated(colnames(ct)) || anyDuplicated(md$analysis_unit) || anyDuplicated(rownames(ct))) stop('Duplicate identity')
  if (!setequal(colnames(ct),md$analysis_unit)) stop('Unmatched count/metadata profiles')
  if (!is.null(expected_profiles) && ncol(ct)!=expected_profiles) stop('Unexpected profile count')
  if (any(!is.finite(ct)) || any(ct<0) || any(ct!=round(ct))) stop('Invalid raw counts')
  md<-md[match(colnames(ct),md$analysis_unit),,drop=FALSE]
  rownames(md)<-md$analysis_unit
  if (anyNA(md$block) || anyNA(md$condition) || !setequal(unique(md$condition),levels)) stop('Invalid treatment coding')
  md$condition<-factor(md$condition,levels=levels);md$block<-factor(md$block)
  if (any(table(md$block,md$condition)!=1)) stop('Incomplete or duplicated block-condition cells')
  if (anyDuplicated(mapping$gene_id) || anyDuplicated(mapping$symbol) || anyNA(mapping$symbol) || any(!nzchar(mapping$symbol))) stop('Invalid symbol representatives')
  if (!all(mapping$gene_id %in% rownames(ct))) stop('Unmatched mapping genes')
  design<-model.matrix(~block+condition,md)
  if (qr(design)$rank!=ncol(design) || nrow(design)<=ncol(design)) stop('Unidentifiable design')
  list(metadata=md,design=design)
}
camera_contrast <- function(name,design) {
  x<-setNames(rep(0,ncol(design)),colnames(design))
  if (!all(c('conditionpsilocin_day1','conditionpsilocin_day3') %in% names(x))) stop('Unknown reference coding')
  if(name=='day1_vs_control') x['conditionpsilocin_day1']<-1
  else if(name=='day3_vs_control') x['conditionpsilocin_day3']<-1
  else if(name=='day3_vs_day1') {x['conditionpsilocin_day1']<- -1;x['conditionpsilocin_day3']<-1}
  else stop('Unknown contrast')
  x
}
