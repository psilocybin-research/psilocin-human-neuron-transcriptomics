# Pure functions shared by analysis and checks.
assert_design <- function(md,formula) {
  mm <- model.matrix(formula,md)
  if(qr(mm)$rank<ncol(mm) || nrow(mm)<=ncol(mm)) stop('Nonestimable or saturated design')
  invisible(mm)
}
make_rank <- function(values,symbols) {
  keep <- is.finite(values)&!is.na(symbols)&nzchar(symbols)
  v <- values[keep]; s <- symbols[keep]
  if(anyDuplicated(s)) stop('Duplicate ranked symbols')
  z <- order(-v,s,method='radix'); setNames(v[z],s[z])
}
family_bh <- function(p,n) {
  if(length(p)>n) stop('Multiplicity family exceeded')
  p.adjust(ifelse(is.finite(p),p,1),method='BH',n=n)
}
classify_robustness <- function(q,nes,block,technical) {
  aligned <- function(x) length(x)>0 && all(is.finite(x)) && all(sign(x)==sign(nes)) && nes!=0
  # Missing results imply uncertainty, never robust evidence.
  if(q<.05) {
    if(any(is.finite(block)&sign(block)!=sign(nes))) return('block-dependent')
    if(aligned(block)&&aligned(technical)) return('robust')
    return('directionally consistent but uncertain')
  }
  if(aligned(block)&&aligned(technical)) return('directionally consistent but uncertain')
  'unsupported'
}
