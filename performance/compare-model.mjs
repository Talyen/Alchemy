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

  for (const [label, env] of [
    ["before", beforeEnv],
    ["after", afterEnv],
  ]) {
    if (
      !["chromium", "electron"].includes(env.runtime) ||
      typeof env.platform !== "string" ||
      !env.platform ||
      typeof env.arch !== "string" ||
      !env.arch ||
      typeof env.traceMode !== "boolean" ||
      typeof env.coldMode !== "boolean" ||
      !Number.isInteger(env.runsPerScenario) ||
      env.runsPerScenario < 1 ||
      !Number.isFinite(env.viewport?.width) ||
      env.viewport.width <= 0 ||
      !Number.isFinite(env.viewport?.height) ||
      env.viewport.height <= 0
    )
      errors.push(`Incomplete or invalid ${label} environment metadata.`);
    for (const field of ["devicePixelRatio", "estimatedRefreshHz"]) {
      if (env[field] !== undefined && (!Number.isFinite(env[field]) || env[field] <= 0))
        errors.push(`Invalid ${label} ${field}.`);
    }
  }
  for (const field of [
    "runtime",
    "platform",
    "arch",
    "traceMode",
    "coldMode",
    "runsPerScenario",
    "devicePixelRatio",
    "estimatedRefreshHz",
    "browser",
  ]) {
    if (beforeEnv[field] !== afterEnv[field])
      errors.push(`Incompatible ${field}: "${beforeEnv[field]}" vs "${afterEnv[field]}".`);
  }
  if (
    beforeEnv.viewport?.width !== afterEnv.viewport?.width ||
    beforeEnv.viewport?.height !== afterEnv.viewport?.height
  )
    errors.push("Incompatible viewport.");

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
  if (beforeScenario.scenario !== afterScenario.scenario) errors.push("Different scenario identities.");
  if (
    !["continuous", "transition"].includes(beforeScenario.profile) ||
    beforeScenario.profile !== afterScenario.profile
  )
    errors.push(`Incompatible target profile for scenario "${beforeScenario.scenario}".`);
  if (beforeScenario.caseIdentity !== afterScenario.caseIdentity) {
    errors.push(`Incompatible case checkpoint for scenario "${beforeScenario.scenario}".`);
  }
  const beforeSegments = (beforeScenario.segments ?? []).map((segment) => segment.name);
  const afterSegments = (afterScenario.segments ?? []).map((segment) => segment.name);
  if (JSON.stringify(beforeSegments) !== JSON.stringify(afterSegments)) {
    errors.push(`Incompatible measured segments for scenario "${beforeScenario.scenario}".`);
  }
  for (const beforeSegment of beforeScenario.segments ?? []) {
    const afterSegment = afterScenario.segments?.find((segment) => segment.name === beforeSegment.name);
    if (afterSegment && beforeSegment.actions !== afterSegment.actions) {
      errors.push(`Different action count in ${beforeScenario.scenario}/${beforeSegment.name}.`);
    }
  }
  const actionShape = (scenario) =>
    scenario.runs?.flatMap((run) => (run.actions ?? []).map(({ name, segment }) => [name, segment]));
  if (
    beforeScenario.caseIdentity &&
    JSON.stringify(actionShape(beforeScenario)) !== JSON.stringify(actionShape(afterScenario))
  ) {
    errors.push(`Different action path for scenario "${beforeScenario.scenario}".`);
  }
  return { compatible: errors.length === 0, errors };
}

export function assertScenarioCompatibility(beforeScenario, afterScenario) {
  const { compatible, errors } = checkScenarioCompatibility(beforeScenario, afterScenario);
  if (!compatible) {
    throw new Error(`Performance comparison rejected due to incompatible scenario profile:\n- ${errors.join("\n- ")}`);
  }
}

function assertComparableMetrics(metrics) {
  if (
    !metrics ||
    metrics.valid !== true ||
    !Number.isInteger(metrics.frameCount) ||
    metrics.frameCount <= 0 ||
    !Number.isFinite(metrics.durationMs) ||
    metrics.durationMs <= 0 ||
    COMPARE_KEYS.some(({ key }) => !Number.isFinite(metrics[key]) || metrics[key] < 0)
  )
    throw new Error(`Invalid performance metrics: ${metrics?.invalidReason ?? "missing or nonfinite measurements"}`);
}

export function deriveComparisonMetrics(metrics) {
  assertComparableMetrics(metrics);
  const ratePer30s = (count) => (count / metrics.durationMs) * 30_000;

  return {
    ...metrics,
    hitchesOver50ms: ratePer30s(metrics.hitchesOver50ms),
    stallsOver100ms: ratePer30s(metrics.stallsOver100ms),
    longTasksOver50ms: ratePer30s(metrics.longTasksOver50ms),
  };
}

export function formatCompareNumber(n, digits = 2) {
  return Number.isFinite(n) ? n.toFixed(digits) : "n/a";
}

export function renderComparisonTable(deltas) {
  const lines = ["| Metric | Before | After | Δ | % |", "| --- | ---: | ---: | ---: | ---: |"];
  for (const d of deltas) {
    const pct = d.percentChange === null ? "n/a" : `${formatCompareNumber(d.percentChange, 1)}%`;
    const mark = d.improved === true ? " improved" : d.improved === false ? " regressed" : "";
    lines.push(
      `| ${d.label} | ${formatCompareNumber(d.before)} | ${formatCompareNumber(d.after)} | ${formatCompareNumber(d.delta)}${mark} | ${pct} |`,
    );
  }
  return lines;
}

export function compareMetrics(beforeMetrics, afterMetrics) {
  const bNorm = deriveComparisonMetrics(beforeMetrics);
  const aNorm = deriveComparisonMetrics(afterMetrics);

  return COMPARE_KEYS.map(({ key, label, higherIsBetter }) => {
    const b = bNorm[key];
    const a = aNorm[key];
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
    if (d?.improved === false && (d.before === 0 || Math.abs(d.percentChange) > 5)) {
      regressions.push(
        `${d.label} regressed by ${d.percentChange === null ? "an increase from zero" : `${Math.abs(d.percentChange).toFixed(1)}%`}`,
      );
    }
  }

  if (!improved && notes.length === 0) {
    notes.push("no ≥10% p99/hitch improvement detected");
  }

  return { ok: improved && regressions.length === 0, notes: [...notes, ...regressions] };
}

export function compareReports(beforeReport, afterReport) {
  assertEnvironmentCompatibility(beforeReport.environment, afterReport.environment);

  for (const report of [beforeReport, afterReport]) {
    if (
      !Array.isArray(report.scenarios) ||
      report.scenarios.length === 0 ||
      new Set(report.scenarios.map(({ scenario }) => scenario)).size !== report.scenarios.length
    )
      throw new Error("Expected distinct performance scenarios in both reports.");
    for (const scenario of report.scenarios) {
      assertComparableMetrics(scenario.aggregate);
      for (const segment of scenario.segments ?? []) assertComparableMetrics(segment.aggregate);
      for (const run of scenario.runs ?? []) {
        if (!run.measured) continue;
        assertComparableMetrics(run.metrics);
        if (run.segments?.some((segment) => !segment.valid))
          throw new Error(`Invalid measured segment in ${scenario.scenario}.`);
      }
    }
  }
  const afterByName = new Map(afterReport.scenarios.map((s) => [s.scenario, s]));
  const results = [];

  for (const b of beforeReport.scenarios) {
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
    const segmentDeltas = (b.segments ?? []).map((segment) => ({
      name: segment.name,
      deltas: compareMetrics(segment.aggregate, a.segments.find((item) => item.name === segment.name).aggregate),
    }));
    results.push({
      scenario: b.scenario,
      profile: b.profile,
      deltas,
      segmentDeltas,
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
