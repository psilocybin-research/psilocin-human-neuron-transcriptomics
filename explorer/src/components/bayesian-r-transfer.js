import { rExamples } from "./r-examples.js";

export function directionalRCode(priors, scores, inputHash) {
  if (
    !["effect_sd", "residual_sd", "eta"].every(
      (key) => Number.isFinite(priors[key]) && priors[key] > 0,
    )
  )
    throw Error("Invalid prior parameters");
  if (
    scores.length !== 3 ||
    !scores.every((row) => row.length === 2 && row.every(Number.isFinite))
  )
    throw Error("Expected three paired block observations");
  let code = rExamples.find((example) => example.id === "bayesian").code;
  code = code
    .replace("effect_sd <- 0.5", `effect_sd <- ${priors.effect_sd}`)
    .replace("residual_sd <- 0.5", `residual_sd <- ${priors.residual_sd}`)
    .replace("correlation_eta <- 2", `correlation_eta <- ${priors.eta}`);
  code = code.replace(
    'Y <- as.matrix(bayesian_scores[, c("day1_vs_control", "day3_vs_control")])',
    `Y <- matrix(c(${scores.flat().join(", ")}), ncol=2, byrow=TRUE)\ncolnames(Y) <- c("day1_vs_control", "day3_vs_control")`,
  );
  code = code
    .replace("grid_points <- 42", "grid_points <- 82")
    .replace("rho_points <- 61", "rho_points <- 151")
    .replace("rho_points <= 121", "rho_points <= 221");
  code = code
    .replace(',"treated_day_difference"', "")
    .replace(", summarize(m3-m1,V11+V22-2*V12)", "");
  code = code.replace(
    'print(subset(bayesian_archive, likelihood=="normal" & effect_sd==results$effect_sd[1] & residual_sd==results$residual_sd[1]))',
    'if (exists("bayesian_archive")) print(subset(bayesian_archive, likelihood=="normal" & effect_sd==results$effect_sd[1] & residual_sd==results$residual_sd[1]))',
  );
  code = code.replaceAll("1:3", "1:2").replace(',"Treated Day 3 - Day 1"', "");
  return `# Transferred OXPHOS directional analysis; editable code, not executed automatically.\n# Input SHA-256: ${/^[a-f0-9]{64}$/.test(inputHash) ? inputHash : "unavailable"}\n# H+: mean > 0; H-: mean <= 0. Equal prior odds. Not a point-null test.\n# All 182 mapped OXPHOS genes; NOT the displayed 113-gene network.\n# Two dependent day/control comparisons; do not multiply their BFs.\n# Uses the selected priors, explicit block scores, and an 82 x 82 x 151 grid.\n# Check a finer grid before interpreting; R computation may use substantial memory.\n\n${code}`;
}
