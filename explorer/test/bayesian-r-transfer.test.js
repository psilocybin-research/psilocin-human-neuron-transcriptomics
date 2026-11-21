import test from "node:test";
import assert from "node:assert/strict";
import { directionalRCode } from "../src/components/bayesian-r-transfer.js";
test("R transfer carries exact priors and paired observations without a new day-difference hypothesis", () => {
  const code = directionalRCode(
    { effect_sd: 0.375, residual_sd: 0.5, eta: 4 },
    [
      [0.1, 0.2],
      [0.3, 0.4],
      [0.5, 0.6],
    ],
    "a".repeat(64),
  );
  assert.match(code, /effect_sd <- 0\.375/);
  assert.match(code, /correlation_eta <- 4/);
  assert.match(code, /Y <- matrix\(c\(0\.1, 0\.2, 0\.3, 0\.4, 0\.5, 0\.6\)/);
  assert.doesNotMatch(code, /treated_day_difference|summarize\(m3-m1|1:3/);
  assert.match(code, /rho_points <- 151/);
  assert.match(code, /not executed automatically/);
  assert.throws(() =>
    directionalRCode({ effect_sd: NaN, residual_sd: 1, eta: 2 }, [], ""),
  );
});
