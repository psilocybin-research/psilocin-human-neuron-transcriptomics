// The proper encompassing prior is restricted to positive/nonpositive means.
// Its symmetric sign prior has odds 1:1. This is not a point-null Bayes factor.
export function directionalModel(scores, priors, points = 58, rhoPoints = 101) {
  const { effect_sd: e, residual_sd: s, eta } = priors;
  if (
    ![e, s, eta].every((x) => Number.isFinite(x) && x > 0) ||
    scores.length !== 3 ||
    scores.some((r) => r.length !== 2 || r.some((x) => !Number.isFinite(x)))
  )
    throw Error(
      "Three finite paired observations and proper positive priors are required.",
    );
  if (
    e < 0.125 ||
    e > 2 ||
    s < 0.125 ||
    s > 2 ||
    eta < 1 ||
    eta > 4 ||
    points < 20 ||
    points > 130 ||
    rhoPoints < 21 ||
    rhoPoints > 221
  )
    throw Error("Settings exceed validated interactive bounds.");
  // A&S 7.1.26: absolute normal-CDF approximation error below 8e-8.
  function cdf(z) {
    const x = Math.abs(z),
      t = 1 / (1 + 0.2316419 * x);
    const q =
      (Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)) *
      t *
      (0.31938153 +
        t *
          (-0.356563782 +
            t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z >= 0 ? 1 - q : q;
  }
  const n = 3,
    y = [0, 0],
    S = [0, 0, 0];
  for (const r of scores) {
    y[0] += r[0] / n;
    y[1] += r[1] / n;
  }
  for (const r of scores) {
    const a = r[0] - y[0],
      b = r[1] - y[1];
    S[0] += a * a;
    S[1] += a * b;
    S[2] += b * b;
  }
  const lower = Math.log(0.0001),
    upper = Math.log(Math.max(8 * s, 6 * Math.sqrt(Math.max(S[0], S[2]) / 2)));
  const sd = Array.from({ length: points }, (_, i) =>
    Math.exp(lower + (i * (upper - lower)) / (points - 1)),
  );
  const count = points * points * rhoPoints,
    cells = new Float64Array(count * 5),
    edges = new Uint8Array(count);
  let cursor = 0,
    maximum = -Infinity;
  for (let i = 0; i < points; i++)
    for (let j = 0; j < points; j++)
      for (let k = 0; k < rhoPoints; k++) {
        const a = sd[i],
          b = sd[j],
          r = -0.9995 + (k * 1.999) / (rhoPoints - 1),
          om = 1 - r * r;
        const I11 = 1 / (a * a * om),
          I22 = 1 / (b * b * om),
          I12 = -r / (a * b * om);
        const M11 = (a * a) / n + e * e,
          M22 = (b * b) / n + e * e,
          M12 = (r * a * b) / n,
          detM = M11 * M22 - M12 * M12;
        let logw =
          (-(n - 1) / 2) * Math.log(a * a * b * b * om) -
          0.5 * Math.log(detM) -
          0.5 * (I11 * S[0] + 2 * I12 * S[1] + I22 * S[2]) -
          (0.5 *
            (M22 * y[0] * y[0] - 2 * M12 * y[0] * y[1] + M11 * y[1] * y[1])) /
            detM -
          0.5 * (a / s) ** 2 -
          0.5 * (b / s) ** 2 +
          (eta - 1) * Math.log(om) +
          Math.log(a) +
          Math.log(b);
        const edgeI = i === 0 || i === points - 1,
          edgeJ = j === 0 || j === points - 1,
          edgeK = k === 0 || k === rhoPoints - 1;
        logw -= (Number(edgeI) + Number(edgeJ) + Number(edgeK)) * Math.log(2);
        const q1 = n * I11 + 1 / (e * e),
          q3 = n * I22 + 1 / (e * e),
          q12 = n * I12,
          d = q1 * q3 - q12 * q12;
        const v1 = q3 / d,
          v3 = q1 / d,
          v12 = -q12 / d,
          b1 = n * (I11 * y[0] + I12 * y[1]),
          b3 = n * (I12 * y[0] + I22 * y[1]);
        const offset = cursor * 5;
        cells[offset] = logw;
        cells[offset + 1] = v1 * b1 + v12 * b3;
        cells[offset + 2] = v12 * b1 + v3 * b3;
        cells[offset + 3] = Math.sqrt(v1);
        cells[offset + 4] = Math.sqrt(v3);
        edges[cursor++] = Number(edgeI || edgeJ || edgeK);
        maximum = Math.max(maximum, logw);
      }
  let total = 0,
    edgeMass = 0;
  const retained = [];
  for (let i = 0; i < count; i++) {
    const offset = i * 5,
      w = Math.exp(cells[offset] - maximum);
    total += w;
    if (edges[i]) edgeMass += w;
    if (w > 1e-16)
      retained.push([
        w,
        cells[offset + 1],
        cells[offset + 2],
        cells[offset + 3],
        cells[offset + 4],
      ]);
  }
  const summaries = [];
  for (let day = 0; day < 2; day++) {
    let p = 0,
      negative = 0,
      mean = 0;
    for (const c of retained) {
      const w = c[0] / total,
        m = c[day + 1],
        v = c[day + 3];
      p += w * cdf(m / v);
      negative += w * cdf(-m / v);
      mean += w * m;
    }
    const mixtureCDF = (x) => {
      let z = 0;
      for (const c of retained)
        z += (c[0] / total) * cdf((x - c[day + 1]) / c[day + 3]);
      return z;
    };
    const quantile = (q) => {
      let lo = -12 * e - 2,
        hi = 12 * e + 2;
      for (let k = 0; k < 42; k++) {
        const mid = (lo + hi) / 2;
        if (mixtureCDF(mid) < q) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const density = [];
    for (let i = 0; i <= 180; i++) {
      const x =
        -Math.max(0.5, 2.5 * e) +
        (i * (Math.max(0.5, 2.5 * e) + Math.max(0.8, 2.5 * e))) / 180;
      let posterior = 0;
      for (const c of retained) {
        const z = (x - c[day + 1]) / c[day + 3];
        posterior +=
          ((c[0] / total) * Math.exp((-z * z) / 2)) /
          (c[day + 3] * Math.sqrt(2 * Math.PI));
      }
      density.push({
        score: x,
        posterior_density: posterior,
        prior_density:
          Math.exp(-0.5 * (x / e) ** 2) / (e * Math.sqrt(2 * Math.PI)),
        day: `Day ${day === 0 ? 1 : 3}`,
      });
    }
    summaries.push({
      day: `Day ${day === 0 ? 1 : 3}`,
      mean,
      median: quantile(0.5),
      lower95: quantile(0.025),
      upper95: quantile(0.975),
      probability_positive: p,
      probability_nonpositive: negative,
      prior_probability_positive: 0.5,
      bf_positive_nonpositive: p / negative,
      log10_bf: Math.log10(p) - Math.log10(negative),
      density,
    });
  }
  return {
    priors: { ...priors },
    points,
    rhoPoints,
    edge_mass: edgeMass / total,
    summaries,
  };
}
