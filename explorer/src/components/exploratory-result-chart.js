import { Plot, scientificPlot, interactiveMark } from "./scientific-plot.js";
import { plotPalette } from "./plot-theme.js";
import { parseExploratoryCSV, exploratoryColumns, exploratoryPoints, EXPLORATORY_PREVIEW_LIMITS } from "./exploratory-result-data.js";

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** A linked preview of user-computed results; never modifies archived findings. */
export function createExploratoryResultChart({ csv, run, onSelectGene }) {
  const root = element("section", "exploratory-result-chart");
  root.append(element("div", "eyebrow", "USER EXPLORATORY RESULTS"), element("h3", "", "Explore computed results"), element("p", "note", "Values come directly from this R run’s results CSV. This display is separate from the frozen analysis; choosing axes does not fit a model or recalculate statistics."));
  if (run?.run_utc) root.append(element("p", "note", `Recorded run (UTC): ${run.run_utc}`));
  if (typeof run?.id === "string" || typeof run?.id === "number") root.append(element("p", "note", `Run: ${run.id}`));
  const parsed = parseExploratoryCSV(csv), columns = exploratoryColumns(parsed);
  root.dispose = () => {};
  if (parsed.error || columns.length < 2) {
    root.append(element("p", "note", parsed.error || "A scatterplot will be available when results.csv contains at least two numerical columns with finite values."));
    return root;
  }
  const controls = element("div", "comparison-controls");
  const stage = element("div", "exploratory-result-stage");
  const status = element("p", "note"), selected = element("p", "note");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const useGene = element("button", "button button-tonal", "Use gene selection");
  useGene.type = "button";
  useGene.hidden = true;
  root.append(controls, status, stage, selected, useGene);
  let xIndex = columns[0].index, yIndex = columns[1].index, selectedPoint = null, disposed = false, frame;
  const columnName = (index) => columns.find((column) => column.index === index)?.name || `Column ${index + 1}`;
  function axis(title, value, change) {
    const label = element("label", "control");
    label.append(element("span", "", title));
    const input = element("select");
    input.setAttribute("aria-label", title);
    for (const column of columns) {
      const option = element("option", "", `${column.name} · column ${column.index + 1}`);
      option.value = String(column.index);
      input.append(option);
    }
    input.value = String(value);
    input.addEventListener("change", () => { change(Number(input.value)); selectedPoint = null; render(); });
    label.append(input);
    controls.append(label);
  }
  axis("Exploratory x axis", xIndex, (value) => { xIndex = value; });
  axis("Exploratory y axis", yIndex, (value) => { yIndex = value; });
  useGene.addEventListener("click", () => {
    if (selectedPoint?.geneId) onSelectGene?.(selectedPoint.geneId);
  });
  function activate(point) {
    selectedPoint = point;
    render();
  }
  function render() {
    if (disposed) return;
    const points = exploratoryPoints(parsed, xIndex, yIndex);
    const palette = plotPalette();
    const width = Math.max(280, Math.min(1200, Math.round(stage.getBoundingClientRect().width || 760)));
    const describe = (point) => `Result row ${point.rowIndex + 1}${point.geneId ? ` · ${point.geneId}` : ""}; ${columnName(xIndex)}: ${Number(point.x.toPrecision(4))}; ${columnName(yIndex)}: ${Number(point.y.toPrecision(4))}`;
    const svg = scientificPlot({
      title: "User exploratory R results",
      description: "Direct CSV values, without model fitting or recalculation. These are user-generated exploratory results, separate from the frozen findings.",
      width,
      height: Math.min(520, Math.max(320, width * 0.65)),
      x: { label: columnName(xIndex), grid: true },
      y: { label: columnName(yIndex), grid: true },
      marks: [Plot.dot(points, {
        x: "x", y: "y", r: 4, fill: palette.accent, fillOpacity: 0.75,
        title: describe,
        render: interactiveMark(points, activate, describe),
      }), ...(selectedPoint ? [Plot.dot([selectedPoint], { x: "x", y: "y", r: 7, fill: "none", stroke: palette.highlight, strokeWidth: 2 })] : [])],
    });
    stage.replaceChildren(svg);
    status.textContent = `${points.length} / ${parsed.rows.length} preview rows have finite values on both chosen axes.${parsed.truncated ? ` Preview is limited to the first ${EXPLORATORY_PREVIEW_LIMITS.rows.toLocaleString()} complete rows within ${EXPLORATORY_PREVIEW_LIMITS.characters.toLocaleString()} characters.` : ""} Complete results remain available through the R results download.`;
    selected.textContent = selectedPoint ? describe(selectedPoint) : "Select a point to inspect its CSV values. Gene linking requires an exact ENSG identifier in a gene_id, id, ensembl or ensembl_gene_id column.";
    useGene.hidden = !selectedPoint?.geneId || typeof onSelectGene !== "function";
  }
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(render);
  });
  observer.observe(stage);
  root.dispose = () => {
    disposed = true;
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
  render();
  return root;
}
