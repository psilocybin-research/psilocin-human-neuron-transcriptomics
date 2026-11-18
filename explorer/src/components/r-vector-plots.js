// Record the already executed graphics display lists; never rerun user code.
export const vectorSetup = String.raw`
dev.control(displaylist="enable")
.atlas_graphics <- new.env(parent=emptyenv())
.atlas_graphics$plots <- list()
.atlas_graphics$started <- FALSE
.atlas_graphics$save <- function(...) {
  if (.atlas_graphics$started && length(.atlas_graphics$plots) < 4L)
    .atlas_graphics$plots[[length(.atlas_graphics$plots)+1L]] <- grDevices::recordPlot()
}
setHook("before.plot.new", .atlas_graphics$save)
setHook("plot.new", function(...) .atlas_graphics$started <- TRUE)
setHook("before.grid.newpage", .atlas_graphics$save)
setHook("grid.newpage", function(...) .atlas_graphics$started <- TRUE)
`;
export const vectorFinish = String.raw`
.atlas_graphics$save()
setHook("before.plot.new", NULL, "replace")
setHook("plot.new", NULL, "replace")
setHook("before.grid.newpage", NULL, "replace")
setHook("grid.newpage", NULL, "replace")
`;
export async function readVectorPlots(runtime) {
  const count = await runtime.evalRNumber("length(.atlas_graphics$plots)");
  const plots = [];
  for (let i = 1; i <= Math.min(count, 4); i++) {
    await runtime.evalRVoid(`local({
      p <- .atlas_graphics$plots[[${i}]]
      grDevices::svg('/home/web_user/vector-${i}.svg', width=10, height=6.5, pointsize=14, bg='white')
      tryCatch(grDevices::replayPlot(p), finally=grDevices::dev.off())
      grDevices::cairo_pdf('/home/web_user/vector-${i}.pdf', width=10, height=6.5, pointsize=14, bg='white', fallback_resolution=300)
      tryCatch(grDevices::replayPlot(p), finally=grDevices::dev.off())
    })`);
    plots.push({
      svg: await runtime.FS.readFile(`/home/web_user/vector-${i}.svg`),
      pdf: await runtime.FS.readFile(`/home/web_user/vector-${i}.pdf`),
    });
  }
  return plots;
}
