import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import type { FrameMetrics, InputEventSample, TargetCheck, TargetProfile } from "./metrics";
import type { MetricDelta } from "./compare";

export interface ScenarioRunResult {
  scenario: string;
  runIndex: number;
  measured: boolean;
  profile: TargetProfile;
  metrics: FrameMetrics;
  targets: TargetCheck[];
  tracePath?: string;
  notes?: string[];
  runtimeBefore?: RuntimeSnapshot;
  runtimeAfter?: RuntimeSnapshot;
  inputEvents?: InputEventSample[];
  observations?: Record<string, number>;
}

export interface RuntimeSnapshot {
  jsHeapUsedBytes?: number;
  domNodes: number;
  images: number;
  canvases: number;
  audioElements: number;
  electronWorkingSetKB?: number;
}

export interface ScenarioAggregate {
  scenario: string;
  profile: TargetProfile;
  aggregate: FrameMetrics;
  targets: TargetCheck[];
  runs: ScenarioRunResult[];
}

export interface EnvironmentInfo {
  timestamp: string;
  platform: string;
  arch: string;
  node: string;
  runtime: "chromium" | "electron";
  viewport: { width: number; height: number };
  devicePixelRatio?: number;
  estimatedRefreshHz?: number;
  commit: string;
  dirtyTree: boolean;
  branch: string;
  traceMode: boolean;
  runsPerScenario: number;
  coldMode: boolean;
  scenarios: string[];
  browser?: string;
}

export function getOutputDir(): string {
  const dir = process.env.PERF_OUTPUT_DIR;
  if (!dir) {
    throw new Error("PERF_OUTPUT_DIR is not set — run via npm run perf");
  }
  return dir;
}

export function ensureOutputDirs(): { root: string; runs: string; traces: string } {
  const root = getOutputDir();
  const runs = path.join(root, "runs");
  const traces = path.join(root, "traces");
  fs.mkdirSync(runs, { recursive: true });
  fs.mkdirSync(traces, { recursive: true });
  return { root, runs, traces };
}

export function writeRunResult(result: ScenarioRunResult): string {
  const { runs } = ensureOutputDirs();
  const file = path.join(runs, `${result.scenario}-${result.runIndex}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  return file;
}

export function collectGitState(): { commit: string; dirtyTree: boolean; branch: string } {
  try {
    const commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    const dirtyTree = execSync("git status --porcelain", { encoding: "utf8" }).trim().length > 0;
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
    return { commit, dirtyTree, branch };
  } catch {
    return { commit: "unknown", dirtyTree: false, branch: "unknown" };
  }
}

export function writeEnvironment(info: EnvironmentInfo): string {
  const { root } = ensureOutputDirs();
  const file = path.join(root, "environment.json");
  fs.writeFileSync(file, JSON.stringify(info, null, 2));
  return file;
}

export function writeResultsJson(aggregates: ScenarioAggregate[], environment: EnvironmentInfo): string {
  const { root } = ensureOutputDirs();
  const file = path.join(root, "results.json");
  fs.writeFileSync(file, JSON.stringify({ environment, scenarios: aggregates }, null, 2));
  return file;
}

function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "n/a";
  return n.toFixed(digits);
}

function bandEmoji(band: TargetCheck["band"]): string {
  if (band === "green") return "GREEN";
  if (band === "yellow") return "YELLOW";
  return "RED";
}

export function renderSummaryMarkdown(options: {
  environment: EnvironmentInfo;
  aggregates: ScenarioAggregate[];
  comparisons?: Array<{ scenario: string; deltas: MetricDelta[]; notes: string[] }>;
}): string {
  const { environment, aggregates, comparisons } = options;
  const lines: string[] = [];

  lines.push("# Performance profile");
  lines.push("");
  lines.push(`- **Timestamp:** ${environment.timestamp}`);
  lines.push(`- **Runtime:** ${environment.runtime}`);
  lines.push(`- **Platform:** ${environment.platform} ${environment.arch}`);
  lines.push(`- **Commit:** \`${environment.commit}\`${environment.dirtyTree ? " (dirty tree)" : ""}`);
  lines.push(`- **Branch:** ${environment.branch}`);
  lines.push(`- **Viewport:** ${environment.viewport.width}×${environment.viewport.height}`);
  if (environment.devicePixelRatio !== undefined) {
    lines.push(`- **DPR:** ${environment.devicePixelRatio}`);
  }
  if (environment.estimatedRefreshHz !== undefined) {
    lines.push(`- **Estimated refresh:** ~${environment.estimatedRefreshHz} Hz`);
  }
  if (environment.browser) {
    lines.push(`- **Browser:** ${environment.browser}`);
  }
  lines.push(`- **Trace mode:** ${environment.traceMode ? "yes (targets not authoritative)" : "no"}`);
  lines.push(`- **Runs per scenario:** ${environment.runsPerScenario}`);
  lines.push(`- **Cold mode:** ${environment.coldMode ? "yes (no warm-up; fresh Electron process per run)" : "no"}`);
  lines.push("");

  if (environment.traceMode) {
    lines.push("> Deep-trace mode adds overhead. Use these results for diagnosis, not for target classification.");
    lines.push("");
  }

  for (const agg of aggregates) {
    lines.push(`## ${agg.scenario} (${agg.profile})`);
    lines.push("");
    if (!agg.aggregate.valid) {
      lines.push(`**INVALID aggregate:** ${agg.aggregate.invalidReason ?? "unknown"}`);
      lines.push("");
    }

    lines.push("| Signal | Actual | Target | Band |");
    lines.push("| --- | ---: | ---: | --- |");
    for (const t of agg.targets) {
      const cmp = t.comparator === "<=" ? "≤" : "≥";
      lines.push(`| ${t.label} | ${fmt(t.actual)} | ${cmp} ${fmt(t.target)} | ${bandEmoji(t.band)} |`);
    }
    lines.push("");

    lines.push("### Aggregate metrics");
    lines.push("");
    lines.push(`- Frames: ${agg.aggregate.frameCount}`);
    lines.push(`- Duration: ${fmt(agg.aggregate.durationMs / 1000, 1)} s`);
    lines.push(`- Average FPS: ${fmt(agg.aggregate.averageFps, 1)}`);
    lines.push(
      `- Frame times p50/p95/p99/p99.9: ${fmt(agg.aggregate.p50FrameTime)} / ${fmt(agg.aggregate.p95FrameTime)} / ${fmt(agg.aggregate.p99FrameTime)} / ${fmt(agg.aggregate.p999FrameTime)} ms`,
    );
    lines.push(
      `- 1% / 0.1% low: ${fmt(agg.aggregate.onePercentLowFps, 1)} / ${fmt(agg.aggregate.pointOnePercentLowFps, 1)} FPS`,
    );
    lines.push(`- Max frame gap: ${fmt(agg.aggregate.maxFrameGapMs)} ms`);
    lines.push(`- Worst gaps: ${agg.aggregate.worstFrameGaps.map((g) => fmt(g, 1)).join(", ") || "none"}`);
    lines.push("");

    if (agg.aggregate.hitchEvents.length > 0) {
      lines.push("### Hitch events (≥50 ms frame gaps)");
      lines.push("");
      lines.push("| Time (ms) | Gap (ms) | Phase |");
      lines.push("| ---: | ---: | --- |");
      for (const hitch of agg.aggregate.hitchEvents.slice(0, 20)) {
        lines.push(`| ${fmt(hitch.timeMs, 0)} | ${fmt(hitch.gapMs, 1)} | ${hitch.phase} |`);
      }
      lines.push("");
    }

    if (agg.aggregate.longTasks.length > 0) {
      lines.push("### Long tasks (≥50 ms)");
      lines.push("");
      lines.push("| Start (ms) | Duration (ms) | Phase |");
      lines.push("| ---: | ---: | --- |");
      for (const task of agg.aggregate.longTasks.slice(0, 20)) {
        lines.push(`| ${fmt(task.startTime, 0)} | ${fmt(task.duration, 1)} | ${task.phase} |`);
      }
      lines.push("");
    }

    const observationKeys = Array.from(new Set(agg.runs.flatMap((run) => Object.keys(run.observations ?? {})))).sort();
    if (observationKeys.length > 0) {
      lines.push("### Additional observations");
      lines.push("");
      lines.push("| Observation | Mean | Min | Max |");
      lines.push("| --- | ---: | ---: | ---: |");
      for (const key of observationKeys) {
        const values = agg.runs
          .map((run) => run.observations?.[key])
          .filter((value): value is number => value !== undefined && Number.isFinite(value));
        if (values.length === 0) continue;
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        lines.push(
          `| ${key} | ${fmt(average, 1)} ms | ${fmt(Math.min(...values), 1)} ms | ${fmt(Math.max(...values), 1)} ms |`,
        );
      }
      lines.push("");
    }

    lines.push("### Per-run");
    lines.push("");
    lines.push("| Run | Valid | Avg FPS | p95 | p99 | 1% low | Hitches≥50 | Long tasks |");
    lines.push("| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (const run of agg.runs.filter((r) => r.measured)) {
      const m = run.metrics;
      lines.push(
        `| ${run.runIndex} | ${m.valid ? "yes" : (m.invalidReason ?? "no")} | ${fmt(m.averageFps, 1)} | ${fmt(m.p95FrameTime)} | ${fmt(m.p99FrameTime)} | ${fmt(m.onePercentLowFps, 1)} | ${m.hitchesOver50ms} | ${m.longTasksOver50ms} |`,
      );
      if (run.tracePath) {
        lines.push(`| | | Trace: \`${run.tracePath}\` | | | | | |`);
      }
      if (run.runtimeBefore && run.runtimeAfter) {
        const heapDelta =
          run.runtimeBefore.jsHeapUsedBytes !== undefined && run.runtimeAfter.jsHeapUsedBytes !== undefined
            ? (run.runtimeAfter.jsHeapUsedBytes - run.runtimeBefore.jsHeapUsedBytes) / 1_048_576
            : null;
        const workingSetDelta =
          run.runtimeBefore.electronWorkingSetKB !== undefined && run.runtimeAfter.electronWorkingSetKB !== undefined
            ? (run.runtimeAfter.electronWorkingSetKB - run.runtimeBefore.electronWorkingSetKB) / 1024
            : null;
        lines.push(
          `| | | Runtime Δ: ${heapDelta === null ? "heap n/a" : `${fmt(heapDelta, 1)} MiB heap`}, ${workingSetDelta === null ? "working set n/a" : `${fmt(workingSetDelta, 1)} MiB working set`}, ${run.runtimeAfter.domNodes - run.runtimeBefore.domNodes} DOM nodes, ${run.runtimeAfter.images - run.runtimeBefore.images} images, ${run.runtimeAfter.canvases - run.runtimeBefore.canvases} canvases, ${run.runtimeAfter.audioElements - run.runtimeBefore.audioElements} audio elements | | | | | |`,
        );
      }
      if (run.inputEvents && run.inputEvents.length > 0) {
        const worstInput = Math.max(...run.inputEvents.map((event) => event.duration));
        const worstDelay = Math.max(...run.inputEvents.map((event) => event.inputDelay));
        lines.push(`| | | Input max: ${fmt(worstInput, 1)} ms event / ${fmt(worstDelay, 1)} ms delay | | | | | |`);
      }
    }
    lines.push("");
  }

  if (comparisons && comparisons.length > 0) {
    lines.push("## Before / after");
    lines.push("");
    for (const cmp of comparisons) {
      lines.push(`### ${cmp.scenario}`);
      lines.push("");
      lines.push("| Metric | Before | After | Δ | % |");
      lines.push("| --- | ---: | ---: | ---: | ---: |");
      for (const d of cmp.deltas) {
        const pct = d.percentChange === null ? "n/a" : `${fmt(d.percentChange, 1)}%`;
        const mark = d.improved === true ? " improved" : d.improved === false ? " regressed" : "";
        lines.push(`| ${d.label} | ${fmt(d.before)} | ${fmt(d.after)} | ${fmt(d.delta)}${mark} | ${pct} |`);
      }
      for (const note of cmp.notes) {
        lines.push(`- ${note}`);
      }
      lines.push("");
    }
  }

  lines.push("## Notes");
  lines.push("");
  lines.push("- Advisory targets only — missing a target does not fail the harness.");
  lines.push("- rAF sampling detects main-thread cadence gaps; it is not a GPU-present measurement.");
  lines.push("- Compare only on the same machine, display, and runtime (Chromium vs Electron).");
  lines.push("");

  return lines.join("\n");
}

export function writeSummaryMarkdown(
  environment: EnvironmentInfo,
  aggregates: ScenarioAggregate[],
  comparisons?: Array<{ scenario: string; deltas: MetricDelta[]; notes: string[] }>,
): string {
  const { root } = ensureOutputDirs();
  const file = path.join(root, "summary.md");
  const markdown = renderSummaryMarkdown({ environment, aggregates, comparisons });
  fs.writeFileSync(file, markdown);
  return file;
}

export function loadRunResults(dir: string): ScenarioRunResult[] {
  const runsDir = path.join(dir, "runs");
  if (!fs.existsSync(runsDir)) return [];
  return fs
    .readdirSync(runsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(runsDir, f), "utf8")) as ScenarioRunResult);
}

export function loadResultsJson(dir: string): {
  environment: EnvironmentInfo;
  scenarios: ScenarioAggregate[];
} | null {
  const file = path.join(dir, "results.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
