// Rebuild exact prior-setting caches; never interpolate evidence between settings.
import fs from "node:fs";
import { directionalModel } from "../src/components/bayesian-directional-model.js";
const path = new URL("../src/data/bayesian-directional.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(path));
const scores = data.scores.map((r) => [+r.day1_vs_control, +r.day3_vs_control]);
data.precomputed = [];
for (const r of data.settings.filter((r) => r.day === "Day 1")) {
  const priors = {
    effect_sd: r.effect_sd,
    residual_sd: r.residual_sd,
    eta: r.eta,
  };
  const model = directionalModel(scores, priors, 82, 151);
  data.precomputed.push({
    ...model,
    classification: "precomputed exploratory normal model",
    input_sha256: data.provenance.input_sha256,
    log10_bf_grid_difference: Math.max(
      ...data.settings
        .filter(
          (s) =>
            s.effect_sd === r.effect_sd &&
            s.residual_sd === r.residual_sd &&
            s.eta === r.eta,
        )
        .map((s) =>
          Math.abs(
            s.log10_bf - model.summaries.find((m) => m.day === s.day).log10_bf,
          ),
        ),
    ),
    numerically_resolved: true,
  });
  console.log(priors);
}
for (const model of data.precomputed) {
  model.numerically_resolved =
    model.log10_bf_grid_difference < 0.02 && model.edge_mass < 0.001;
  if (!model.numerically_resolved)
    throw new Error("Precomputed prior failed numerical checks");
}
fs.writeFileSync(path, JSON.stringify(data));
