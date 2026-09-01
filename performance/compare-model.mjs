import fs from "node:fs";
import { URL } from "node:url";

const catalog = JSON.parse(fs.readFileSync(new URL("./catalog.json", import.meta.url), "utf8"));

export const COMPARE_KEYS = catalog.metrics;

export function checkEnvironmentCompatibility(beforeEnv, afterEnv) {
  const errors = [];
  if (!beforeEnv || !afterEnv) {
    errors.push("Missing environment metadata in one or both reports.");
    return { compatible: false, errors };
  }

  if (beforeEnv.runtime !== afterEnv.runtime) {
    errors.push(`Incompatible runtime: "${beforeEnv.runtime}" vs "${afterEnv.runtime}".`);
  }
  if (Boolean(beforeEnv.traceMode) !== Boolean(afterEnv.traceMode)) {
    errors.push(`Incompatible trace mode: ${beforeEnv.traceMode} vs ${afterEnv.traceMode}.`);
  }
  if (Boolean(beforeEnv.coldMode) !== Boolean(afterEnv.coldMode)) {
    errors.push(`Incompatible cold mode: ${beforeEnv.coldMode} vs ${afterEnv.coldMode}.`);
  }
  if (beforeEnv.platform !== afterEnv.platform) {
    errors.push(`Incompatible platform: "${beforeEnv.platform}" vs "${afterEnv.platform}".`);
  }
  if (
    beforeEnv.viewport?.width !== afterEnv.viewport?.width ||
    beforeEnv.viewport?.height !== afterEnv.viewport?.height
  ) {
    errors.push(
      `Incompatible viewport: ${beforeEnv.viewport?.width}×${beforeEnv.viewport?.height} vs ${afterEnv.viewport?.width}×${afterEnv.viewport?.height}.`,
    );
  }
  if (
    beforeEnv.devicePixelRatio !== undefined &&
    afterEnv.devicePixelRatio !== undefined &&
    beforeEnv.devicePixelRatio !== afterEnv.devicePixelRatio
  ) {
    errors.push(`Incompatible device pixel ratio: ${beforeEnv.devicePixelRatio} vs ${afterEnv.devicePixelRatio}.`);
  }
  if (
    beforeEnv.estimatedRefreshHz !== undefined &&
    afterEnv.estimatedRefreshHz !== undefined &&
    beforeEnv.estimatedRefreshHz !== afterEnv.estimatedRefreshHz
  ) {
    errors.push(
      `Incompatible refresh estimate: ~${beforeEnv.estimatedRefreshHz} Hz vs ~${afterEnv.estimatedRefreshHz} Hz.`,
    );
  }
  if (beforeEnv.browser !== undefined && afterEnv.browser !== undefined && beforeEnv.browser !== afterEnv.browser) {
    errors.push(`Incompatible browser: "${beforeEnv.browser}" vs "${afterEnv.browser}".`);
  }

  return { compatible: errors.length === 0, errors };
}

export function assertEnvironmentCompatibility(beforeEnv, afterEnv) {
  const { compatible, errors } = checkEnvironmentCompatibility(beforeEnv, afterEnv);
  if (!compatible) {
    throw new Error(`Performance comparison rejected due to incompatible environments:\n- ${errors.join("\n- ")}`);
  }
}

export function checkScenarioCompatibility(beforeScenario, afterScenario) {
  const errors = [];
  if (!beforeScenario || !afterScenario) {
    errors.push("Missing scenario data.");
    return { compatible: false, errors };
  }
  if (beforeScenario.profile && afterScenario.profile && beforeScenario.profile !== afterScenario.profile) {
    errors.push(
      `Incompatible target profile for scenario "${beforeScenario.scenario}": "${beforeScenario.profile}" vs "${afterScenario.profile}".`,
    );
  }
  return { compatible: errors.length === 0, errors };
}

export function assertScenarioCompatibility(beforeScenario, afterScenario) {
  const { compatible, errors } = checkScenarioCompatibility(beforeScenario, afterScenario);
  if (!compatible) {
    throw new Error(`Performance comparison rejected due to incompatible scenario profile:\n- ${errors.join("\n- ")}`);
  }
}

export function deriveComparisonMetrics(metrics) {
  if (!metrics) return metrics;
  const durationSec = metrics.durationMs > 0 ? metrics.durationMs / 1000 : 0;
  const normalizeRate = (count) => {
    if (!Number.isFinite(count) || count === 0 || durationSec === 0) return count ?? 0;
    return (count / durationSec) * 30; // normalized to rate per 30 seconds
  };

  return {
    ...metrics,
    hitchesOver50ms: normalizeRate(metrics.hitchesOver50ms),
    stallsOver100ms: normalizeRate(metrics.stallsOver100ms),
    longTasksOver50ms: normalizeRate(metrics.longTasksOver50ms),
  };
}

export function compareMetrics(beforeMetrics, afterMetrics) {
  const bNorm = deriveComparisonMetrics(beforeMetrics);
  const aNorm = deriveComparisonMetrics(afterMetrics);

  return COMPARE_KEYS.map(({ key, label, higherIsBetter }) => {
    const b = bNorm[key] ?? 0;
    const a = aNorm[key] ?? 0;
    const delta = a - b;
    const percentChange = b === 0 ? null : (delta / b) * 100;
    let improved = null;
    if (delta !== 0) {
      improved = higherIsBetter ? delta > 0 : delta < 0;
    }
    return { key, label, before: b, after: a, delta, percentChange, higherIsBetter, improved };
  });
}

export function meetsOptimizationRule(deltas) {
  const notes = [];
  const p99 = deltas.find((d) => d.key === "p99FrameTime");
  const hitches = deltas.find((d) => d.key === "hitchesOver50ms");

  let improved = false;
  if (p99 && p99.percentChange !== null && p99.improved && Math.abs(p99.percentChange) >= 10) {
    improved = true;
    notes.push(`p99 improved by ${Math.abs(p99.percentChange).toFixed(1)}%`);
  }
  if (hitches && hitches.before > 0 && hitches.after === 0) {
    improved = true;
    notes.push("eliminated all ≥50 ms hitches");
  } else if (hitches && hitches.percentChange !== null && hitches.improved && Math.abs(hitches.percentChange) >= 10) {
    improved = true;
    notes.push(`hitches improved by ${Math.abs(hitches.percentChange).toFixed(1)}%`);
  }

  const regressions = [];
  for (const key of ["p95FrameTime", "p99FrameTime"]) {
    const d = deltas.find((x) => x.key === key);
    if (d && d.percentChange !== null && d.improved === false && Math.abs(d.percentChange) > 5) {
      regressions.push(`${d.label} regressed by ${Math.abs(d.percentChange).toFixed(1)}%`);
    }
  }

  if (!improved && notes.length === 0) {
    notes.push("no ≥10% p99/hitch improvement detected");
  }

  return { ok: improved && regressions.length === 0, notes: [...notes, ...regressions] };
}

export function compareReports(beforeReport, afterReport) {
  assertEnvironmentCompatibility(beforeReport.environment, afterReport.environment);

  const afterByName = new Map((afterReport.scenarios ?? []).map((s) => [s.scenario, s]));
  const results = [];

  for (const b of beforeReport.scenarios ?? []) {
    const a = afterByName.get(b.scenario);
    if (!a) {
      results.push({
        scenario: b.scenario,
        profile: b.profile,
        missing: true,
        deltas: [],
        notes: ["Missing in after report."],
        rule: { ok: false, notes: ["Missing in after report."] },
      });
      continue;
    }
    assertScenarioCompatibility(b, a);
    const deltas = compareMetrics(b.aggregate, a.aggregate);
    const rule = meetsOptimizationRule(deltas);
    results.push({
      scenario: b.scenario,
      profile: b.profile,
      deltas,
      notes: rule.notes,
      rule,
    });
  }

  return {
    beforeEnvironment: beforeReport.environment,
    afterEnvironment: afterReport.environment,
    scenarios: results,
  };
}
