// Official Framework7 SVGs, selected from the pinned MIT-licensed package at build time.
import { icons } from "../assets/vendor/framework7-icons.js";
const NS = "http://www.w3.org/2000/svg";
const names = {
  overview: "eye",
  landscape: "square_grid_3x2",
  genes: "doc_text_search",
  pathways: "arrow_branch",
  robustness: "checkmark_shield",
  comparison: "chart_bar",
  methods: "book",
  share: "share",
  appearance: "moon",
  sun: "sun_max",
  menu: "line_horizontal_3",
  search: "search",
  controls: "slider_horizontal_3",
  close: "xmark",
  back: "chevron_left",
  print: "printer",
  labels: "textformat_size",
  fullscreen: "arrow_up_left_arrow_down_right",
  fullscreenExit: "arrow_down_right_arrow_up_left",
  top: "arrow_up",
  github: "logo_github",
  plus: "plus",
  minus: "minus",
  copy: "doc_on_doc",
  done: "checkmark",
};
export function uiIcon(kind, cls = "") {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", `f7-icon-svg ${cls}`.trim());
  if (kind === "share") {
    svg.setAttribute("viewBox", "0 0 56 56");
    svg.dataset.iconSource = "scientific-extension";
    svg.innerHTML =
      '<g fill="none" stroke="currentColor" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"><path d="M17 25l23-13M17 31l23 13"/><circle cx="11" cy="28" r="6"/><circle cx="46" cy="9" r="6"/><circle cx="46" cy="47" r="6"/></g>';
    return svg;
  }
  if (kind === "dna") {
    // Scientific extension: matched optical weight, rounded terminals and a 56-unit F7 grid.
    svg.setAttribute("viewBox", "0 0 56 56");
    svg.dataset.iconSource = "scientific-extension";
    svg.innerHTML =
      '<g transform="scale(2.333333)" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3c0 9 10 9 10 18M17 3c0 9-10 9-10 18M8 5h8M9 9h6M9 15h6M8 19h8"/></g>';
    return svg;
  }
  const name = names[kind] || kind,
    definition = icons[name];
  if (!definition) throw new Error(`Unknown interface icon: ${kind}`);
  svg.setAttribute("viewBox", definition.viewBox);
  svg.dataset.f7Icon = name;
  svg.style.fill = "currentColor";
  svg.innerHTML = definition.body;
  return svg;
}
