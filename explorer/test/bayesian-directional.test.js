import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { directionalModel } from "../src/components/bayesian-directional-model.js";
const data = JSON.parse(
  readFileSync(
    new URL("../src/data/bayesian-directional.json", import.meta.url),
  ),
);
const scores = data.scores.map((r) => [+r.day1_vs_control, +r.day3_vs_control]);
test("browser quadrature agrees with independent refined SciPy integration", () => {
  for (const priors of [
    { effect_sd: 0.5, residual_sd: 0.5, eta: 2 },
    { effect_sd: 0.25, residual_sd: 1, eta: 2 },
    { effect_sd: 1, residual_sd: 0.25, eta: 2 },
    { effect_sd: 0.5, residual_sd: 0.5, eta: 1 },
  ]) {
    const actual = directionalModel(scores, priors, 82, 151);
    assert.ok(actual.edge_mass < 0.001);
    for (const r of actual.summaries) {
      const expected = data.settings.find(
        (x) =>
          x.day === r.day &&
          x.effect_sd === priors.effect_sd &&
          x.residual_sd === priors.residual_sd &&
          x.eta === priors.eta,
      );
      assert.ok(expected, `reference exists for ${r.day}`);
      assert.ok(Math.abs(r.log10_bf - expected.log10_bf) < 0.015);
      assert.ok(Math.abs(r.mean - expected.mean) < 0.002);
      assert.ok(Math.abs(r.median - expected.median) < 0.004);
      assert.ok(Math.abs(r.lower95 - expected.lower95) < 0.004);
      assert.ok(Math.abs(r.upper95 - expected.upper95) < 0.004);
      assert.ok(
        Math.abs(r.probability_positive + r.probability_nonpositive - 1) < 1e-9,
      );
    }
  }
});
test("sign reversal inverts directional BF; paired-day swap swaps summaries", () => {
  const p = { effect_sd: 0.5, residual_sd: 0.5, eta: 2 };
  const base = directionalModel(scores, p, 35, 61);
  const reflected = directionalModel(
    scores.map((r) => r.map((v) => -v)),
    p,
    35,
    61,
  );
  const swapped = directionalModel(
    scores.map((r) => [r[1], r[0]]),
    p,
    35,
    61,
  );
  for (let i = 0; i < 2; i++) {
    assert.ok(
      Math.abs(base.summaries[i].log10_bf + reflected.summaries[i].log10_bf) <
        1e-10,
    );
    assert.ok(
      Math.abs(base.summaries[i].mean - swapped.summaries[1 - i].mean) < 1e-10,
    );
  }
});
test("invalid observations and priors fail explicitly", () => {
  assert.throws(() =>
    directionalModel(scores.slice(1), {
      effect_sd: 0.5,
      residual_sd: 0.5,
      eta: 2,
    }),
  );
  assert.throws(() =>
    directionalModel(scores, { effect_sd: 0, residual_sd: 0.5, eta: 2 }),
  );
});

test("all precomputed prior settings agree with refined references", () => {
  assert.equal(data.precomputed.length, 11);
  for (const model of data.precomputed) {
    assert.equal(model.input_sha256, data.provenance.input_sha256);
    assert.ok(model.numerically_resolved);
    assert.ok(model.log10_bf_grid_difference < 0.02);
    assert.ok(model.edge_mass < 0.001);
    for (const row of model.summaries) {
      const ref = data.settings.find(
        (r) =>
          r.day === row.day &&
          r.effect_sd === model.priors.effect_sd &&
          r.residual_sd === model.priors.residual_sd &&
          r.eta === model.priors.eta,
      );
      assert.ok(Math.abs(row.log10_bf - ref.log10_bf) < 0.002);
      assert.ok(row.density.some((d) => d.day === row.day));
    }
  }
});
