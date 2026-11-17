import * as Plot from "../assets/vendor/observable-plot.js";
import { themeScientificSVG } from "./plot-theme.js";
export { Plot };

// All statistical charts share a portable, accessible SVG rendering contract.
// Scientific values, density estimates and selection state remain caller-owned.
export function scientificPlot({ title, description, ...options }) {
  const svg = Plot.plot({
    width: 760,
    height: 440,
    marginLeft: 64,
    marginBottom: 54,
    style: {
      fontFamily: "system-ui,sans-serif",
      fontSize: "12px",
      background: "transparent",
    },
    ...options,
    ariaLabel: title,
    ariaDescription: description,
  });
  svg.dataset.plotRenderer = "observable-plot";
  svg.setAttribute("role", "img");
  svg.style.maxWidth = "100%";
  svg.style.height = "auto";
  themeScientificSVG(svg);
  return svg;
}

export function interactiveMark(data, activate, describe) {
  return function (index, scales, values, dimensions, context, next) {
    const group = next(index, scales, values, dimensions, context);
    const nodes = [...group.children].filter((n) =>
      n.matches("circle,path,rect"),
    );
    nodes.forEach((node, i) => {
      const row = data[index[i]];
      if (!row) return;
      node.setAttribute("role", "button");
      node.setAttribute("tabindex", "0");
      node.setAttribute("aria-label", describe(row));
      node.style.cursor = "pointer";
      node.addEventListener("click", () => activate(row));
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate(row);
        }
      });
    });
    return group;
  };
}

// Dense, pointer-selected plots retain every observation while avoiding tens of
// thousands of live SVG nodes. Plot still owns scales and circle geometry.
// Individual identifiers remain available through nearest-point selection,
// autocomplete, numerical selection and complete exports.
export function batchDenseCircles(
  index,
  scales,
  values,
  dimensions,
  context,
  next,
) {
  const group = next(index, scales, values, dimensions, context);
  if (index.length < 2000) return group;
  const paths = new Map();
  for (const node of group.querySelectorAll("circle")) {
    const x = Number(node.getAttribute("cx")),
      y = Number(node.getAttribute("cy")),
      r = Number(node.getAttribute("r"));
    const fill =
      node.getAttribute("fill") || group.getAttribute("fill") || "currentColor";
    const opacity =
      node.getAttribute("fill-opacity") ||
      group.getAttribute("fill-opacity") ||
      "1";
    const key = `${fill}|${opacity}`;
    if (!paths.has(key)) paths.set(key, { fill, opacity, d: [] });
    paths
      .get(key)
      .d.push(
        `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`,
      );
  }
  if (!paths.size) return group;
  group.replaceChildren(
    ...[...paths.values()].map(({ fill, opacity, d }) => {
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      path.setAttribute("d", d.join(""));
      path.setAttribute("fill", fill);
      path.setAttribute("fill-opacity", opacity);
      path.dataset.densePoints = "true";
      return path;
    }),
  );
  return group;
}
