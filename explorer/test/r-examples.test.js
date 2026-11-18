import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rExamples } from "../src/components/r-examples.js";
const available = spawnSync("Rscript", ["--version"]).status === 0;
test(
  "Bayesian normal-model quadrature matches archived NUTS and is stable under grid refinement",
  { skip: !available },
  () => {
    const code = rExamples.find((x) => x.id === "bayesian").code;
    const script = `bayesian_scores <- read.csv('tables/bayesian_oxphos/paired_scores.csv')
bayesian_archive <- read.csv('tables/bayesian_oxphos/posterior_summary.csv')
pdf(tempfile(fileext='.pdf'))
eval(parse(text=${JSON.stringify(code)}))
coarse <- results
ref <- subset(bayesian_archive, likelihood=='normal' & effect_sd==0.5 & residual_sd==0.5)[1:3,]
stopifnot(max(abs(results$mean-ref$mean)) < 0.015)
stopifnot(max(abs(results$lower95-ref$lower95)) < 0.025)
stopifnot(max(abs(results$upper95-ref$upper95)) < 0.025)
eval(parse(text=${JSON.stringify(code.replace("grid_points <- 42", "grid_points <- 84").replace("rho_points <- 61", "rho_points <- 121"))}))
stopifnot(max(abs(results$mean-coarse$mean)) < .001)
stopifnot(max(abs(results$lower95-coarse$lower95)) < .001)
eval(parse(text=${JSON.stringify(code.replace("effect_sd <- 0.5", "effect_sd <- 0.25"))}))
stopifnot(results$mean[1] < coarse$mean[1]-.02)
dev.off()
`;
    const result = spawnSync("Rscript", ["-e", script], {
      cwd: new URL("../../", import.meta.url),
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  },
);
