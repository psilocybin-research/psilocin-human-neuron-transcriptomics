import reference from "../assets/vendor/bayesian-directional-data.js";
import {
  createElement as el,
  createAccordion,
  loadingMessage,
} from "./interface-utils.js";

// Score-level evidence deliberately remains independent of gene selection and filters.
export function createNetworkBayesianEvidence({
  day = 0,
  onAnalysis,
  onSendToR,
} = {}) {
  const root = el("section", "card card-outline network-bayesian-evidence");
  const body = el("div", "card-content card-content-padding");
  const summary = el("div", "network-bayesian-summary");
  summary.setAttribute("aria-live", "polite");
  let model = {
    priors: { effect_sd: 0.5, residual_sd: 0.5, eta: 2 },
    summaries: reference.settings.filter(
      (r) => r.effect_sd === 0.5 && r.residual_sd === 0.5 && r.eta === 2,
    ),
  };
  let compare = false,
    analysis,
    pending = false,
    disposed = false;
  const compareButton = el("button", "button button-tonal", "Compare days");
  compareButton.type = "button";
  compareButton.setAttribute("aria-pressed", "false");
  compareButton.onclick = () => {
    compare = !compare;
    compareButton.setAttribute("aria-pressed", String(compare));
    compareButton.textContent = compare
      ? "Follow selected day"
      : "Compare days";
    render();
  };
  const explore = createAccordion(
    "Explore priors and distributions",
    "network-bayesian-explore",
  );
  explore.element.addEventListener("accordion:open", async () => {
    if (analysis || pending) return;
    pending = true;
    explore.body.replaceChildren(
      loadingMessage("Loading Bayesian prior controls…"),
    );
    try {
      const { createDirectionalEvidence } = await import(
        "./bayesian-directional.js"
      );
      if (disposed) return;
      analysis = createDirectionalEvidence({
        onSendToR,
        onResult(next) {
          model = next;
          render();
        },
      });
      explore.body.replaceChildren(analysis);
    } catch {
      if (!disposed)
        explore.body.replaceChildren(
          el(
            "p",
            "note",
            "Controls could not load. Reopen this card to retry.",
          ),
        );
    } finally {
      pending = false;
    }
  });
  const sendR = el("button", "button button-tonal", "Open analysis in R");
  sendR.type = "button";
  sendR.onclick = async () => {
    const { directionalRCode } = await import("./bayesian-r-transfer.js");
    if (disposed) return;
    const code = directionalRCode(
      model.priors,
      reference.scores.map((r) => [+r.day1_vs_control, +r.day3_vs_control]),
      reference.provenance.input_sha256,
    );
    if (onSendToR) onSendToR(code);
    else
      root.dispatchEvent(
        new CustomEvent("atlas:send-analysis-to-r", {
          bubbles: true,
          detail: { code },
        }),
      );
  };
  body.append(
    el("strong", "", "Bayesian OXPHOS · score-level evidence"),
    el(
      "p",
      "note",
      "Exploratory follow-up · all 182 originally mapped OXPHOS genes, not the displayed 113-gene membership network or an individual gene.",
    ),
    summary,
    compareButton,
    el(
      "p",
      "note",
      "H+: positive mean score shift; H−: nonpositive shift. These are separate day-versus-common-control comparisons. Comparing their Bayes factors does not test Day 1 versus Day 3. Gene filters and RNA node colours do not change this score analysis.",
    ),
    explore.element,
  );
  if (onAnalysis) {
    const full = el(
      "button",
      "button button-tonal",
      "Open full Bayesian analysis",
    );
    full.type = "button";
    full.onclick = onAnalysis;
    body.append(full);
  }
  body.append(sendR);
  root.append(body);
  function render() {
    const selectedDay = day === 1 ? "Day 3" : "Day 1";
    const rows = model.summaries.filter(
      (r) => compare || r.day === selectedDay,
    );
    summary.replaceChildren();
    for (const r of rows) {
      const item = el("section", "network-bayesian-day");
      const hero = el("div", "directional-bf-hero");
      const metrics = el("div", "directional-bf-metrics");
      metrics.append(
        el("span", "directional-bf-label", `${r.day} / common control · BF+/−`),
        el(
          "strong",
          "directional-bf-value",
          Number(r.bf_positive_nonpositive.toPrecision(3)).toString(),
        ),
      );
      const wheel = el("div", "directional-probability-wheel");
      wheel.style.setProperty(
        "--directional-positive-share",
        `${100 * r.probability_positive}%`,
      );
      wheel.setAttribute("role", "img");
      wheel.setAttribute(
        "aria-label",
        `Posterior positive probability ${(100 * r.probability_positive).toFixed(1)} percent, under equal prior odds`,
      );
      hero.append(metrics, wheel);
      item.append(
        hero,
        el(
          "p",
          "note",
          `P(positive) ${(100 * r.probability_positive).toFixed(1)}% · mean ${r.mean.toFixed(3)} · 95% CrI ${r.lower95.toFixed(3)} to ${r.upper95.toFixed(3)}.`,
        ),
      );
      summary.append(item);
    }
    summary.append(
      el(
        "p",
        "note",
        `Normal effect SD ${model.priors.effect_sd}; Half-Normal residual scale ${model.priors.residual_sd}; LKJ(${model.priors.eta}). Prior odds 1:1. Blue: posterior positive probability; grey: nonpositive. Not a point-null test or a measure of respiratory activity.`,
      ),
    );
  }
  root.setDay = (next) => {
    day = next;
    render();
  };
  root.dispose = () => {
    disposed = true;
    analysis?.dispose();
  };
  render();
  return root;
}
