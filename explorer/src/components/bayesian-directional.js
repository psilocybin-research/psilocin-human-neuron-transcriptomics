import { createPriorRange } from "./prior-range.js";
import reference from "../assets/vendor/bayesian-directional-data.js";
import { directionalModel } from "./bayesian-directional-model.js";
import { createElement as el, createAccordion } from "./interface-utils.js";
import { Plot, scientificPlot, interactiveMark } from "./scientific-plot.js";
import { downloadFile } from "./file-download.js";
import { showToast } from "./app-toast.js";
import { setLoadingMessage } from "./interface-utils.js";
import { csvText } from "./format.js";

export function createDirectionalEvidence() {
  const root = el("section", "directional-evidence");
  root.append(
    el("h4", "", "Directional evidence · exploratory follow-up"),
    el(
      "p",
      "callout",
      "H+: positive mean OXPHOS score shift versus H−: nonpositive shift. BF+/− compares these directions; it does not test an exact-zero null. The same three paired blocks inform both days.",
    ),
  );
  root.append(
    el(
      "p",
      "note",
      "Both hypotheses restrict the same proper, symmetric prior, giving prior odds 1:1. Effect and residual prior scales use mean log₂(normalized count + 1) units; eta controls the correlation prior. BF+/− equals posterior odds here. This re-expresses directional uncertainty; it is not independent evidence or a test of mitochondrial activity. Do not multiply the two dependent day-specific factors.",
    ),
  );
  const formulaCard = el("div", "card card-outline directional-formulas");
  const formulaBody = el("div", "card-content card-content-padding");
  formulaBody.append(el("strong", "", "Directional comparison"));
  formulaBody.insertAdjacentHTML(
    "beforeend",
    `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="H plus: mu d greater than zero; H minus: mu d less than or equal to zero"><msub><mi>H</mi><mo>+</mo></msub><mo>:</mo><msub><mi>μ</mi><mi>d</mi></msub><mo>&gt;</mo><mn>0</mn><mspace width="2em"/><msub><mi>H</mi><mo>−</mo></msub><mo>:</mo><msub><mi>μ</mi><mi>d</mi></msub><mo>≤</mo><mn>0</mn></math>
  <math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="Directional Bayes factor equals posterior odds divided by prior odds, which here equals p d divided by one minus p d"><msub><mi>BF</mi><mrow><mo>+</mo><mo>/</mo><mo>−</mo></mrow></msub><mo>=</mo><mfrac><mtext>posterior odds</mtext><mtext>prior odds</mtext></mfrac><mo>=</mo><mfrac><msub><mi>p</mi><mi>d</mi></msub><mrow><mn>1</mn><mo>−</mo><msub><mi>p</mi><mi>d</mi></msub></mrow></mfrac></math>`,
  );
  formulaBody.append(
    el(
      "p",
      "note",
      "Here p_d = P(μ_d > 0 | data). Symmetric encompassing priors give prior odds 1:1. The mean μ_d is the day-specific OXPHOS score shift, not mitochondrial activity; H− is not an exact-zero null.",
    ),
  );
  formulaCard.append(formulaBody);
  root.append(formulaCard);
  const controls = el("div", "list list-strong list-dividers inset"),
    ul = el("ul");
  controls.append(ul);
  const fields = {};
  for (const [key, title, values] of [
    ["effect_sd", "Normal effect-prior SD", [0.125, 0.25, 0.5, 1, 2]],
    ["residual_sd", "Half-Normal residual scale", [0.125, 0.25, 0.5, 1, 2]],
    ["eta", "Correlation prior · LKJ eta", [1, 2, 4]],
  ]) {
    if (key !== "eta") {
      const range = createPriorRange({
        title,
        onCommit: () => run.click(),
        onPreview: () => {
          status.textContent =
            "Prior preview: release the slider to recalculate. Plots show the last completed priors.";
        },
      });
      fields[key] = range;
      ul.append(range.element);
      continue;
    }
    const li = el("li", "item-content item-input"),
      inner = el("div", "item-inner"),
      label = el("div", "item-title item-label", title),
      input = el("div", "item-input-wrap"),
      select = el("select");
    select.setAttribute("aria-label", title);
    for (const v of values) {
      const o = el("option", "", String(v));
      o.value = String(v);
      select.append(o);
    }
    select.value = key === "eta" ? "2" : ".5";
    if (key !== "eta") select.value = "0.5";
    input.append(select);
    inner.append(label, input);
    li.append(inner);
    ul.append(li);
    fields[key] = select;
  }
  const actions = el("div", "tree-actions"),
    run = el("button", "button button-fill", "Update priors"),
    reset = el("button", "button button-tonal", "Reset baseline"),
    save = el("button", "button button-tonal", "Download analysis JSON");
  for (const b of [run, reset, save]) b.type = "button";
  actions.append(run, reset, save);
  const status = el(
    "p",
    "note",
    "Baseline deterministic quadrature · refined 130 × 130 × 221 grid.",
  );
  status.setAttribute("role", "status");
  const result = el("div", "directional-summary");
  result.setAttribute("aria-live", "polite");
  const density = el("div", "directional-density-chart directional-summary"),
    blocks = el("div", "directional-block-chart"),
    sensitivity = el("div", "directional-sensitivity-chart"),
    robustness = el("div", "directional-robustness-chart");
  const priorCard = el("section", "card card-outline directional-prior-card");
  const priorBody = el("div", "card-content card-content-padding");
  priorBody.append(
    el("h5", "", "Shared priors · both days"),
    controls,
    el(
      "p",
      "note",
      "Move a prior scale to preview its value; release to recalculate. Use Update priors after changing the correlation prior. Reset baseline restores the original 0.5 / 0.5 / LKJ(2) assumptions.",
    ),
    actions,
    status,
  );
  priorCard.append(priorBody);
  root.append(
    priorCard,
    el("h5", "", "Directional evidence · prior and posterior"),
    density,
    el(
      "p",
      "note",
      "Curves show the unrestricted encompassing model. Dashed curves: zero-centred effect priors. Solid curves: marginal posteriors. The shaded positive side defines H+. Bars beneath the density show equal-tail 95% credible intervals; dots show posterior means. Both days share axes. A narrow curve does not add biological replication.",
    ),
    el("h5", "", "The three paired block observations"),
    blocks,
    el(
      "p",
      "note",
      "Lines connect each block’s two treated-minus-common-control scores. These are relative expression-score differences, not gene log₂ fold changes. Blocks span two genetic backgrounds.",
    ),
    el("h5", "", "Prior-width robustness · directional Bayes factors"),
    robustness,
    el(
      "p",
      "note",
      "H+: μ > 0 versus H−: μ ≤ 0. BF+/− is shown on a logarithmic scale: values above 1 favour H+, below 1 favour H−. Blue: residual prior scale 0.25; orange: 0.5; green: 1. LKJ(2) is fixed. Lines connect the three declared effect-prior widths; they do not represent additional fitted settings. Select a point to explore its priors. The ring marks the current setting when it belongs to this grid.",
    ),
    el("h5", "", "Declared prior sensitivity · all nine settings"),
    sensitivity,
    el(
      "p",
      "note",
      "Each cell shows log₁₀(BF+/−) for a normal effect-prior SD and half-normal residual-SD prior scale; LKJ(2). Zero means equal directional evidence. Positive values favour H+; negative values favour H−. This is not an FDR or a probability of biological benefit. Select a cell to explore that prior setting. The complete declared grid stays visible when interactive priors change.",
    ),
  );
  const details = createAccordion(
    "Model, numerical checks and complete exports",
    "directional-details",
  );
  const modelMath = el("div", "directional-formulas");
  modelMath.innerHTML = `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="Paired block observations follow a bivariate normal with mean mu and covariance Sigma"><msub><mi>y</mi><mi>b</mi></msub><mo>∼</mo><msub><mi>Normal</mi><mn>2</mn></msub><mo>(</mo><mi>μ</mi><mo>,</mo><mi>Σ</mi><mo>)</mo><mspace width="1em"/><mi>Σ</mi><mo>=</mo><mi>D</mi><mi>R</mi><mi>D</mi></math>
  <math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="Mu d has normal prior zero s mu squared; sigma d has half normal prior s sigma; R has LKJ prior eta"><msub><mi>μ</mi><mi>d</mi></msub><mo>∼</mo><mi>Normal</mi><mo>(</mo><mn>0</mn><mo>,</mo><msubsup><mi>s</mi><mi>μ</mi><mn>2</mn></msubsup><mo>)</mo><mspace width="1em"/><msub><mi>σ</mi><mi>d</mi></msub><mo>∼</mo><mi>HalfNormal</mi><mo>(</mo><msub><mi>s</mi><mi>σ</mi></msub><mo>)</mo></math>
  <math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="R has LKJ prior eta"><mi>R</mi><mo>∼</mo><mi>LKJ</mi><mo>(</mo><mi>η</mi><mo>)</mo></math>`;
  modelMath.append(
    el(
      "p",
      "note",
      "b indexes the three paired blocks; d indexes Day 1 and Day 3. D = diag(σ₁, σ₃), and R is the correlation matrix. The effect slider sets s_μ; the residual slider sets s_σ. Normal uses variance as its second argument here.",
    ),
  );
  details.body.append(modelMath);
  details.body.append(
    el(
      "p",
      "note",
      "Bivariate-normal likelihood with a shared-control covariance, independent Normal(0, effect SD) means, HalfNormal residual SDs and LKJ(eta) correlation. Priors are sensitivity assumptions, without external biological calibration. Custom calculations use analytic conditional means and covariance quadrature in a worker. A finer grid checks log₁₀ BF stability; boundary mass and convergence are reported, not hidden. The archived Student-t sensitivity remains a separate likelihood check.",
    ),
    el(
      "p",
      "note",
      "No equivalence threshold is defined. Unresolved control harvest days prevent a treatment-by-time interpretation. Three blocks across two backgrounds do not establish donor-population generalization. This post hoc analysis does not change the frozen results.",
    ),
  );
  const exportGrid = el(
    "button",
    "button button-tonal",
    "Download complete sensitivity CSV",
  );
  exportGrid.type = "button";
  exportGrid.onclick = () =>
    downloadFile(
      "oxphos-directional-sensitivity.csv",
      csvText(reference.settings),
      "text/csv",
    );
  details.body.append(exportGrid);
  const student = reference.archived.filter((r) => r.likelihood !== "normal");
  details.body.append(
    el(
      "p",
      "note",
      `Archived Student-t(4), 0.5/0.5 priors: ${student.map((r) => `${r.day} BF+/− ${r.bf_positive_nonpositive.toFixed(2)}`).join("; ")}. These transform Monte Carlo sign probabilities, retain simulation uncertainty, and are not deterministic refits.`,
    ),
  );
  const source = el("a", "external", "Methods and full numerical results");
  source.href =
    "https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/blob/main/reports/bayesian_directional_results.md";
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  details.body.append(source);
  root.append(details.element);
  let disposed = false,
    worker,
    url,
    current = {
      priors: { effect_sd: 0.5, residual_sd: 0.5, eta: 2 },
      summaries: reference.settings.filter(
        (r) => r.effect_sd === 0.5 && r.residual_sd === 0.5 && r.eta === 2,
      ),
      density: reference.density,
      classification: "post hoc exploratory directional comparison",
      provenance: reference.provenance,
    },
    lastWidth = 0;
  const cacheKey = (p) => [p.effect_sd, p.residual_sd, p.eta].join(":");
  const cache = new Map(
    (reference.precomputed || []).map((m) => [cacheKey(m.priors), m]),
  );
  cache.set(cacheKey(current.priors), current);
  let feedback;
  const notify = (message) => {
    if (feedback?.params) feedback.close();
    feedback = showToast(message, { duration: 2800 });
  };
  const colour = { "Day 1": "#235780", "Day 3": "#a45114" };
  function choosePriors(r) {
    if (run.disabled) return;
    fields.effect_sd.value = String(r.effect_sd);
    fields.residual_sd.value = String(r.residual_sd);
    fields.eta.value = "2";
    for (const f of Object.values(fields))
      f.dispatchEvent(new Event("change", { bubbles: true }));
    run.click();
  }
  function render() {
    const width = Math.floor(root.getBoundingClientRect().width);
    if (width < 220) return;
    lastWidth = width;
    for (const field of Object.values(fields))
      field.init?.(document.querySelector("#psilocin-app")?.f7);
    const rows = current.summaries;
    result.replaceChildren();
    for (const r of rows) {
      const card = el("div", "card"),
        body = el("div", "card-content card-content-padding");
      const number = new Intl.NumberFormat("en-GB", {
        maximumSignificantDigits: 3,
      });
      const bf = r.bf_positive_nonpositive,
        inverse = 1 / bf;
      const wheel = el("div", "directional-probability-wheel");
      wheel.style.setProperty(
        "--directional-positive-share",
        `${100 * r.probability_positive}%`,
      );
      wheel.setAttribute("role", "img");
      wheel.setAttribute(
        "aria-label",
        `${r.day}: posterior positive probability ${(100 * r.probability_positive).toFixed(1)} percent, with equal prior hypothesis odds`,
      );
      const metrics = el("div", "directional-bf-metrics");
      metrics.append(
        el("span", "directional-bf-label", `${r.day} · BF+/−`),
        el("strong", "directional-bf-value", number.format(bf)),
        el("span", "note", `Reciprocal BF−/+ ${number.format(inverse)}`),
      );
      const hero = el("div", "directional-bf-hero");
      hero.append(metrics, wheel);
      body.append(
        hero,
        el(
          "p",
          "directional-bf-explanation",
          `The data favour ${bf >= 1 ? "a positive" : "a nonpositive"} shift over ${bf >= 1 ? "a nonpositive" : "a positive"} shift by ${number.format(bf >= 1 ? bf : inverse)}× under these priors.`,
        ),
        el(
          "p",
          "note",
          `H+: μ > 0 · H−: μ ≤ 0. Prior odds 1:1 → posterior odds ${number.format(bf)}:1.`,
        ),
        el(
          "p",
          "note",
          `Wheel: blue P(H+) ${(100 * r.probability_positive).toFixed(1)}%, grey P(H−) ${(100 * r.probability_nonpositive).toFixed(1)}%.`,
        ),
        el(
          "p",
          "note",
          `Median ${r.median.toFixed(3)} · mean ${r.mean.toFixed(3)} · 95% CrI ${r.lower95.toFixed(3)} to ${r.upper95.toFixed(3)}`,
        ),
      );
      card.append(body);
      card.dataset.day = r.day;
      result.append(card);
    }
    const densities = current.density || rows.flatMap((r) => r.density);
    const domain = [
      Math.min(...densities.map((r) => r.score)),
      Math.max(...densities.map((r) => r.score)),
    ];
    const maximum = Math.max(
      ...densities.map((r) => Math.max(r.posterior_density, r.prior_density)),
    );
    const panelWidth = width >= 640 ? Math.floor((width - 16) / 2) : width;
    const densityPanels = el("div", "directional-plot-panels");
    densityPanels.style.gridTemplateColumns =
      width >= 640 ? "repeat(2,minmax(0,1fr))" : "minmax(0,1fr)";
    for (const r of rows) {
      const data = densities.filter((d) => d.day === r.day);
      const panel = el("section", "directional-density-panel");
      panel.dataset.fullscreenHost = "";
      panel.dataset.fullscreenTitle = `${r.day}: directional Bayesian evidence`;
      const summary = el("div", "directional-day-summary");
      summary.setAttribute("aria-live", "polite");
      summary.append(
        [...result.children].find((card) => card.dataset.day === r.day),
      );
      panel.append(
        summary,
        scientificPlot({
          title: `${r.day}: prior, posterior and 95% credible interval; BF positive/nonpositive ${r.bf_positive_nonpositive.toFixed(2)}`,
          description: `Posterior mean ${r.mean.toFixed(3)}; 95% credible interval ${r.lower95.toFixed(3)} to ${r.upper95.toFixed(3)}. The Bayes factor compares positive with nonpositive shifts, not an exact-zero null.`,
          width: panelWidth,
          height: 320,
          marginLeft: 48,
          marginBottom: 55,
          x: { domain, label: "Mean paired OXPHOS score shift" },
          y: {
            domain: [-0.31 * maximum, 1.08 * maximum],
            label: "Density",
            ticks: Array.from({ length: 5 }, (_, i) => (i * maximum) / 4),
            tickFormat: (d) => d.toFixed(1),
          },
          marks: [
            Plot.rectY([{ x1: 0, x2: domain[1], y: maximum }], {
              x1: "x1",
              x2: "x2",
              y: "y",
              fill: colour[r.day],
              fillOpacity: 0.05,
            }),
            Plot.ruleX([0], { stroke: "#83969e", strokeDasharray: "3,3" }),
            Plot.ruleY([0], { stroke: "#dbe2e6" }),
            Plot.lineY(data, {
              x: "score",
              y: "prior_density",
              stroke: "#687a85",
              strokeDasharray: "5,4",
            }),
            Plot.lineY(data, {
              x: "score",
              y: "posterior_density",
              stroke: colour[r.day],
              strokeWidth: 2,
            }),
            Plot.text(
              [
                { x: domain[0] / 2, label: "H−: μ ≤ 0" },
                { x: domain[1] / 2, label: "H+: μ > 0" },
              ],
              {
                x: "x",
                y: maximum,
                text: "label",
                fontSize: 11,
                fill: "#536771",
              },
            ),
            Plot.ruleY([r], {
              x1: "lower95",
              x2: "upper95",
              y: -0.13 * maximum,
              stroke: colour[r.day],
              strokeWidth: 3,
            }),
            Plot.dot([r], {
              x: "mean",
              y: -0.13 * maximum,
              fill: colour[r.day],
              r: 4,
              title: (d) =>
                `Mean ${d.mean.toFixed(3)}; 95% CrI ${d.lower95.toFixed(3)} to ${d.upper95.toFixed(3)}`,
            }),
            Plot.text([r], {
              x: (domain[0] + domain[1]) / 2,
              y: -0.25 * maximum,
              text: (d) =>
                `95% CrI ${d.lower95.toFixed(3)} to ${d.upper95.toFixed(3)}`,
              fontSize: 11,
            }),
          ],
        }),
      );
      densityPanels.append(panel);
    }
    density.replaceChildren(
      el(
        "p",
        "note",
        "Dashed grey: prior · solid colour: posterior · interval bar and mean beneath each density",
      ),
      densityPanels,
    );
    const robustnessPanels = el("div", "directional-plot-panels");
    robustnessPanels.style.gridTemplateColumns =
      densityPanels.style.gridTemplateColumns;
    for (const day of ["Day 1", "Day 3"]) {
      const data = reference.settings
        .filter((r) => r.day === day && r.eta === 2)
        .map((r) => ({ ...r, residual_label: String(r.residual_sd) }));
      const active =
        current.priors.eta === 2 &&
        [0.25, 0.5, 1].includes(current.priors.effect_sd) &&
        [0.25, 0.5, 1].includes(current.priors.residual_sd)
          ? data.filter(
              (r) =>
                r.effect_sd === current.priors.effect_sd &&
                r.residual_sd === current.priors.residual_sd,
            )
          : [];
      const panel = el("section", "directional-robustness-panel");
      panel.append(
        el("h6", "", day),
        scientificPlot({
          title: `${day}: directional Bayes-factor robustness across declared effect-prior widths`,
          description:
            "Positive versus nonpositive mean shift. Logarithmic Bayes-factor scale; equal directional evidence at one. Three residual-prior scale curves, with LKJ eta two fixed.",
          width: panelWidth,
          height: 290,
          marginLeft: 56,
          marginRight: 16,
          x: {
            type: "log",
            base: 2,
            domain: [0.23, 1.08],
            ticks: [0.25, 0.5, 1],
            tickFormat: (d) => String(d),
            label: "Normal effect-prior SD",
          },
          y: {
            type: "log",
            domain: [1 / 3, 300],
            ticks: [1 / 3, 1, 3, 10, 30, 100, 300],
            tickFormat: (d) => (d === 1 / 3 ? "⅓" : String(d)),
            label: "BF+/− · log scale",
            grid: true,
          },
          color: {
            domain: ["0.25", "0.5", "1"],
            range: ["#235780", "#a45114", "#26734d"],
          },
          marks: [
            Plot.ruleY([1], { stroke: "#687a85", strokeDasharray: "4,3" }),
            Plot.lineY(data, {
              x: "effect_sd",
              y: "bf_positive_nonpositive",
              stroke: "residual_label",
              z: "residual_label",
            }),
            Plot.dot(data, {
              x: "effect_sd",
              y: "bf_positive_nonpositive",
              stroke: "residual_label",
              fill: "white",
              r: 4,
              title: (r) =>
                `${day}: BF+/− ${r.bf_positive_nonpositive.toFixed(2)}; effect SD ${r.effect_sd}; residual scale ${r.residual_sd}`,
              render: interactiveMark(
                data,
                choosePriors,
                (r) =>
                  `${day}: explore effect SD ${r.effect_sd}, residual scale ${r.residual_sd}, LKJ eta 2`,
              ),
            }),
            Plot.dot(active, {
              x: "effect_sd",
              y: "bf_positive_nonpositive",
              stroke: "#14252c",
              fill: "none",
              r: 7,
              strokeWidth: 2,
            }),
          ],
        }),
      );
      robustnessPanels.append(panel);
    }
    robustness.replaceChildren(robustnessPanels);
    const observed = reference.scores.flatMap((r) => [
      { block: r.block, day: "Day 1", score: +r.day1_vs_control },
      { block: r.block, day: "Day 3", score: +r.day3_vs_control },
    ]);
    blocks.replaceChildren(
      el(
        "p",
        "note",
        "Blocks: 68_3 / batch1; 68_3 / batch2; 69_2 / batch1. Each line connects one block.",
      ),
      scientificPlot({
        title: "Three paired differentiation-block observations",
        width,
        height: 250,
        marginLeft: 50,
        color: {
          domain: reference.scores.map((r) => r.block),
          range: ["#235780", "#a45114", "#26734d"],
        },
        x: { label: null, domain: ["Day 1", "Day 3"] },
        y: { label: "Observed paired score difference", grid: true },
        marks: [
          Plot.ruleY([0], { stroke: "#83969e", strokeDasharray: "4,3" }),
          Plot.lineY(observed, {
            x: "day",
            y: "score",
            z: "block",
            stroke: "block",
          }),
          Plot.dot(observed, {
            x: "day",
            y: "score",
            stroke: "block",
            fill: "white",
            r: 5,
            title: (r) => `${r.block}\n${r.day}: ${r.score.toFixed(3)}`,
          }),
        ],
      }),
    );
    const grid = reference.settings
      .filter((r) => r.eta === 2)
      .map((r) => ({
        ...r,
        effect: String(r.effect_sd),
        residual: String(r.residual_sd),
      }));
    sensitivity.replaceChildren(
      el(
        "p",
        "note",
        "Brown: nonpositive direction · neutral: equal directional evidence · teal: positive direction. Numbers show log₁₀ BF+/− on the same −2.5 to +2.5 scale for both days.",
      ),
      scientificPlot({
        title:
          "Complete nine-setting prior sensitivity of directional Bayes factors",
        width,
        height: 280,
        marginLeft: 45,
        marginBottom: 45,
        fx: { domain: ["Day 1", "Day 3"], label: null },
        x: { label: "Normal effect-prior SD", domain: ["0.25", "0.5", "1"] },
        y: { label: "Residual prior scale", domain: ["1", "0.5", "0.25"] },
        color: {
          type: "diverging",
          scheme: "BrBG",
          domain: [-2.5, 2.5],
          pivot: 0,
          legend: false,
          label: "log₁₀ BF+/−",
        },
        marks: [
          Plot.cell(grid, {
            fx: "day",
            x: "effect",
            y: "residual",
            fill: "log10_bf",
            inset: 2,
            stroke: (r) =>
              current.priors.eta === 2 &&
              current.priors.effect_sd === r.effect_sd &&
              current.priors.residual_sd === r.residual_sd
                ? "#14252c"
                : "transparent",
            strokeWidth: 2,
            render: interactiveMark(
              grid,
              choosePriors,
              (r) =>
                `${r.day}: explore effect SD ${r.effect_sd}, residual scale ${r.residual_sd}, LKJ eta 2`,
            ),
            title: (r) =>
              `${r.day}; effect ${r.effect}; residual ${r.residual}\nBF+/− ${r.bf_positive_nonpositive.toFixed(2)}`,
          }),
          Plot.text(grid, {
            fx: "day",
            x: "effect",
            y: "residual",
            text: (r) => r.log10_bf.toFixed(2),
            fill: (r) => (Math.abs(r.log10_bf) > 1.7 ? "white" : "#14252c"),
            fontWeight: 600,
          }),
        ],
      }),
    );
  }
  save.onclick = () =>
    downloadFile(
      "oxphos-directional-analysis.json",
      JSON.stringify(
        {
          schema_version: 1,
          classification: "post hoc exploratory directional evidence",
          ...current,
          observations: reference.scores,
          reference_provenance: reference.provenance,
          model:
            "paired bivariate normal; independent zero-centred normal means, half-normal residual SDs, LKJ correlation",
          exported_at: new Date().toISOString(),
          source_url: location.href,
          input_sha256: reference.provenance.input_sha256,
          hypotheses: reference.provenance.hypotheses,
          prior_odds: 1,
          not_point_null: true,
        },
        null,
        2,
      ),
      "application/json",
    );
  function setControlsDisabled(disabled) {
    for (const field of Object.values(fields)) {
      field.disabled = disabled;
      const wrapper = field.closest?.(".research-smart-select");
      if (wrapper) {
        wrapper.classList.toggle("disabled", disabled);
        wrapper.inert = disabled;
        wrapper.setAttribute("aria-disabled", String(disabled));
        wrapper.tabIndex = disabled ? -1 : 0;
      }
    }
  }
  function stop() {
    worker?.terminate();
    worker = undefined;
    if (url) URL.revokeObjectURL(url);
    url = undefined;
  }
  run.onclick = () => {
    stop();
    const priors = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, +v.value]),
    );
    const cached = cache.get(cacheKey(priors));
    if (cached) {
      current = { ...cached, source_url: location.href };
      status.classList.remove("inline-loading");
      status.textContent =
        "Numerical checks passed. Previously computed result loaded immediately; no interpolation was used.";
      render();
      notify("Bayesian results updated from saved calculations.");
      return;
    }
    const focusedPrior =
      document.activeElement?.getAttribute("role") === "slider"
        ? document.activeElement
        : null;
    run.disabled = true;
    save.disabled = true;
    setControlsDisabled(true);
    root.setAttribute("aria-busy", "true");
    setLoadingMessage(
      status,
      "Computing paired model and checking a finer grid…",
    );
    url = URL.createObjectURL(
      new Blob(
        [
          `const directionalModel = (${directionalModel.toString()});\nonmessage=({data})=>{try{const a=directionalModel(data.scores,data.priors,58,101);const b=directionalModel(data.scores,data.priors,82,151);postMessage({a,b});}catch(e){postMessage({error:e.message});}};`,
        ],
        { type: "text/javascript" },
      ),
    );
    worker = new Worker(url, { name: "oxphos-directional-priors" });
    const finish = () => {
      run.disabled = false;
      save.disabled = false;
      setControlsDisabled(false);
      root.removeAttribute("aria-busy");
      status.classList.remove("inline-loading");
      stop();
      if (focusedPrior?.isConnected)
        focusedPrior.focus({ preventScroll: true });
    };
    worker.onerror = () => {
      if (disposed) return;
      status.textContent =
        "Calculation failed. The last completed result remains visible.";
      finish();
      notify("Calculation failed. Previous results retained.");
    };
    worker.onmessage = ({ data }) => {
      if (disposed) return;
      if (data.error) {
        status.textContent = data.error;
        finish();
        return;
      }
      const delta = Math.max(
        ...data.a.summaries.map((r, i) =>
          Math.abs(r.log10_bf - data.b.summaries[i].log10_bf),
        ),
      );
      current = {
        ...data.b,
        classification: "user-selected exploratory normal model",
        source_url: location.href,
        input_sha256: reference.provenance.input_sha256,
        log10_bf_grid_difference: delta,
        numerically_resolved: delta < 0.02 && data.b.edge_mass < 0.001,
      };
      status.textContent = `${current.numerically_resolved ? "Numerical checks passed." : "Numerical warning: do not interpret this setting without further refinement."} Maximum log₁₀ BF grid difference ${delta.toFixed(4)}; boundary mass ${data.b.edge_mass.toExponential(2)}. ${[priors.effect_sd, priors.residual_sd].some((v) => ![0.25, 0.5, 1].includes(v)) ? "Outside the declared archived prior-scale grid." : ""}`;
      cache.set(cacheKey(priors), current);
      if (cache.size > 32) cache.delete(cache.keys().next().value);
      render();
      finish();
      notify(
        current.numerically_resolved
          ? "Bayesian results updated. Numerical checks passed."
          : "Results updated with a numerical warning. Review the diagnostics.",
      );
    };
    worker.postMessage({
      scores: reference.scores.map((r) => [
        +r.day1_vs_control,
        +r.day3_vs_control,
      ]),
      priors,
    });
  };
  reset.onclick = () => {
    stop();
    run.disabled = false;
    save.disabled = false;
    setControlsDisabled(false);
    root.removeAttribute("aria-busy");
    status.classList.remove("inline-loading");
    for (const [k, f] of Object.entries(fields)) {
      f.value = k === "eta" ? "2" : "0.5";
      f.dispatchEvent(new Event("change", { bubbles: true }));
    }
    current = {
      priors: { effect_sd: 0.5, residual_sd: 0.5, eta: 2 },
      summaries: reference.settings.filter(
        (r) => r.effect_sd === 0.5 && r.residual_sd === 0.5 && r.eta === 2,
      ),
      density: reference.density,
      provenance: reference.provenance,
    };
    status.textContent =
      "Baseline deterministic quadrature · refined 130 × 130 × 221 grid.";
    render();
  };
  const observer = new ResizeObserver(() => {
    if (Math.floor(root.getBoundingClientRect().width) !== lastWidth) render();
  });
  observer.observe(root);
  root.dispose = () => {
    disposed = true;
    if (feedback?.params) feedback.close();
    stop();
    observer.disconnect();
    for (const field of Object.values(fields)) field.destroy?.();
  };
  return root;
}
