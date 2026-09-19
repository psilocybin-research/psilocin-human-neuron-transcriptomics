# Requires R 4.6.1 plus a C/C++ toolchain and standard R build dependencies.
if(as.character(getRversion())!='4.6.1') stop('The frozen environment requires R 4.6.1')
dir.create('.Rlib',showWarnings=FALSE)
.libPaths(c(normalizePath('.Rlib'),.libPaths()))
options(repos=c(CRAN='https://cloud.r-project.org'))
if(!requireNamespace('renv',quietly=TRUE)) install.packages('renv',lib='.Rlib')
renv::restore(lockfile='renv.lock',library=normalizePath('.Rlib'),prompt=FALSE)
