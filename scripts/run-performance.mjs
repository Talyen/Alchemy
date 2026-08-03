#!/usr/bin/env node
/**
 * On-demand FPS / hitch profiling runner.
 * Usage:
 *   node scripts/run-performance.mjs
 *   node scripts/run-performance.mjs --scenario armory-drag --runs 5
 *   node scripts/run-performance.mjs --all
 *   node scripts/run-performance.mjs --trace --scenario battle-effects
 *   node scripts/run-performance.mjs --compare reports/performance/a reports/performance/b
 *   node scripts/run-performance.mjs --electron --scenario armory-drag
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const METRIC_SCENARIOS = ["battle-effects", "battle-end-turn", "armory-drag"];
const DIAG_SCENARIOS = ["battle-art-diag"];
const SCENARIOS = [...METRIC_SCENARIOS, ...DIAG_SCENARIOS];
const DEFAULT_SCENARIO = "battle-effects";

function parseArgs(argv) {
  const args = {
    scenario: null,
    runs: null,
    all: false,
    trace: false,
    electron: false,
    compare: null,
    skipBuild: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--trace") args.trace = true;
    else if (a === "--electron") args.electron = true;
    else if (a === "--skip-build") args.skipBuild = true;
    else if (a === "--all") args.all = true;
    else if (a === "--scenario") args.scenario = argv[++i];
    else if (a === "--runs") args.runs = Number.parseInt(argv[++i], 10);
    else if (a === "--compare") {
      args.compare = [argv[++i], argv[++i]];
    } else if (a.startsWith("--scenario=")) args.scenario = a.slice("--scenario=".length);
    else if (a.startsWith("--runs=")) args.runs = Number.parseInt(a.slice("--runs=".length), 10);
  }
  return args;
}

function printHelp() {
  console.log(`On-demand FPS / hitch profiling

Usage:
  npm run perf
  npm run perf -- --scenario armory-drag --runs 5
  npm run perf -- --all
  npm run perf:trace -- --scenario battle-effects
  npm run perf:compare -- <beforeDir> <afterDir>
  npm run perf -- --electron --scenario battle-end-turn

Options:
  --scenario <id>   One of: ${SCENARIOS.join(", ")} (default: ${DEFAULT_SCENARIO})
  --all             Run metric scenarios (${METRIC_SCENARIOS.join(", ")}; excludes battle-art-diag)
  --runs <n>        Measured repetitions (default 1; warm-up still runs)
  --trace           CDP deep-trace mode (targets not authoritative)
  --electron        Confirm on shipping Electron runtime (separate from Chromium)
  --skip-build      Reuse existing dist/ (must already exist)
  --compare a b     Diff two prior report directories
  --help            Show this help
`);
}

function ensureDist() {
  const indexHtml = path.join(root, "dist", "index.html");
  if (!fs.existsSync(indexHtml)) {
    console.error("dist/ is missing. Building production renderer…");
    const result = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

function buildDist() {
  console.log("Building production renderer for performance profiling…");
  const result = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function stampOutputDir(runtime = "chromium") {
  const stamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d+Z$/, "Z");
  const dir = path.join(root, "reports", "performance", `${stamp}-${runtime}`);
  fs.mkdirSync(path.join(dir, "runs"), { recursive: true });
  fs.mkdirSync(path.join(dir, "traces"), { recursive: true });
  return dir;
}

function compareMetricsJson(before, after) {
  // Keep in sync with performance/compare.ts COMPARE_KEYS / compareMetrics.
  const keys = [
    ["averageFps", "Average FPS", true],
    ["p50FrameTime", "p50 frame time (ms)", false],
    ["p95FrameTime", "p95 frame time (ms)", false],
    ["p99FrameTime", "p99 frame time (ms)", false],
    ["p999FrameTime", "p99.9 frame time (ms)", false],
    ["onePercentLowFps", "1% low FPS", true],
    ["pointOnePercentLowFps", "0.1% low FPS", true],
    ["framesOver20msPct", "frames >20 ms (%)", false],
    ["framesOver33msPct", "frames >33.3 ms (%)", false],
    ["hitchesOver50ms", "≥50 ms hitches", false],
    ["stallsOver100ms", "≥100 ms stalls", false],
    ["longTasksOver50ms", "≥50 ms long tasks", false],
    ["maxFrameGapMs", "Max frame gap (ms)", false],
  ];
  return keys.map(([key, label, higherIsBetter]) => {
    const b = before[key];
    const a = after[key];
    const delta = a - b;
    const percentChange = b === 0 ? null : (delta / b) * 100;
    let improved = null;
    if (delta !== 0) improved = higherIsBetter ? delta > 0 : delta < 0;
    return { key, label, before: b, after: a, delta, percentChange, higherIsBetter, improved };
  });
}

function optimizationNotes(deltas) {
  // Keep in sync with performance/compare.ts meetsOptimizationRule.
  const notes = [];
  const p99 = deltas.find((d) => d.key === "p99FrameTime");
  const hitches = deltas.find((d) => d.key === "hitchesOver50ms");
  let improved = false;
  if (p99?.percentChange !== null && p99?.improved && Math.abs(p99.percentChange) >= 10) {
    improved = true;
    notes.push(`p99 improved by ${Math.abs(p99.percentChange).toFixed(1)}%`);
  }
  if (hitches?.before > 0 && hitches?.after === 0) {
    improved = true;
    notes.push("eliminated all ≥50 ms hitches");
  } else if (hitches?.percentChange !== null && hitches?.improved && Math.abs(hitches.percentChange) >= 10) {
    improved = true;
    notes.push(`hitches improved by ${Math.abs(hitches.percentChange).toFixed(1)}%`);
  }
  for (const key of ["p95FrameTime", "p99FrameTime"]) {
    const d = deltas.find((x) => x.key === key);
    if (d?.percentChange !== null && d?.improved === false && Math.abs(d.percentChange) > 5) {
      notes.push(`${d.label} regressed by ${Math.abs(d.percentChange).toFixed(1)}%`);
    }
  }
  if (!improved && notes.length === 0) notes.push("no ≥10% p99/hitch improvement detected");
  return notes;
}

function fmt(n, digits = 2) {
  return Number.isFinite(n) ? n.toFixed(digits) : "n/a";
}

function runCompare(beforeDir, afterDir) {
  const beforePath = path.resolve(beforeDir);
  const afterPath = path.resolve(afterDir);
  const beforeFile = path.join(beforePath, "results.json");
  const afterFile = path.join(afterPath, "results.json");
  if (!fs.existsSync(beforeFile)) {
    console.error("Missing results.json in", beforePath);
    process.exit(1);
  }
  if (!fs.existsSync(afterFile)) {
    console.error("Missing results.json in", afterPath);
    process.exit(1);
  }

  const before = JSON.parse(fs.readFileSync(beforeFile, "utf8"));
  const after = JSON.parse(fs.readFileSync(afterFile, "utf8"));
  const outDir = stampOutputDir("compare");

  const lines = [
    "# Performance compare",
    "",
    `- **Before:** \`${beforePath}\``,
    `- **After:** \`${afterPath}\``,
    `- **Generated:** ${new Date().toISOString()}`,
    "",
  ];

  const afterByName = new Map(after.scenarios.map((s) => [s.scenario, s]));
  for (const b of before.scenarios) {
    const a = afterByName.get(b.scenario);
    if (!a) {
      lines.push(`## ${b.scenario}`, "", "_Missing in after report._", "");
      continue;
    }
    const deltas = compareMetricsJson(b.aggregate, a.aggregate);
    const notes = optimizationNotes(deltas);
    lines.push(`## ${b.scenario}`, "");
    lines.push("| Metric | Before | After | Δ | % |");
    lines.push("| --- | ---: | ---: | ---: | ---: |");
    for (const d of deltas) {
      const pct = d.percentChange === null ? "n/a" : `${fmt(d.percentChange, 1)}%`;
      const mark = d.improved === true ? " improved" : d.improved === false ? " regressed" : "";
      lines.push(`| ${d.label} | ${fmt(d.before)} | ${fmt(d.after)} | ${fmt(d.delta)}${mark} | ${pct} |`);
    }
    lines.push("");
    for (const note of notes) lines.push(`- ${note}`);
    lines.push("");
  }

  const summaryPath = path.join(outDir, "summary.md");
  fs.writeFileSync(summaryPath, lines.join("\n"));
  fs.writeFileSync(
    path.join(outDir, "results.json"),
    JSON.stringify({ before: beforePath, after: afterPath, generated: new Date().toISOString() }, null, 2),
  );
  console.log(`Compare report written to ${summaryPath}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.compare) {
    runCompare(args.compare[0], args.compare[1]);
    return;
  }

  if (args.all && args.scenario) {
    console.error("Pass either --all or --scenario, not both.");
    process.exit(1);
  }

  if (args.scenario && !SCENARIOS.includes(args.scenario)) {
    console.error(`Unknown scenario "${args.scenario}". Expected one of: ${SCENARIOS.join(", ")}`);
    process.exit(1);
  }

  const scenario = args.all ? null : (args.scenario ?? DEFAULT_SCENARIO);

  if (args.electron) {
    console.log("Ensuring Electron binary…");
    const ensure = spawnSync("npm", ["run", "ensure:electron"], {
      cwd: root,
      stdio: "inherit",
    });
    if (ensure.status !== 0) process.exit(ensure.status ?? 1);
  }

  if (args.skipBuild) {
    ensureDist();
  } else {
    buildDist();
  }

  const outDir = stampOutputDir(args.electron ? "electron" : "chromium");
  const env = {
    ...process.env,
    PERF_OUTPUT_DIR: outDir,
    PLAYWRIGHT_PERF_PORT: process.env.PLAYWRIGHT_PERF_PORT ?? "4176",
    PLAYWRIGHT_PERF_TRACE: args.trace ? "1" : "",
    PLAYWRIGHT_PERF_ELECTRON: args.electron ? "1" : "",
    PERF_RUNS: String(args.runs ?? 1),
    PERF_SCENARIO: scenario ?? "",
    ...(process.env.PERF_MEASURE_MS ? { PERF_MEASURE_MS: process.env.PERF_MEASURE_MS } : {}),
    ...(process.env.PERF_MIN_FRAMES ? { PERF_MIN_FRAMES: process.env.PERF_MIN_FRAMES } : {}),
    ...(args.electron ? { PLAYWRIGHT_ELECTRON_PREVIEW_PORT: process.env.PLAYWRIGHT_PERF_PORT ?? "4176" } : {}),
  };

  // --all runs metric scenarios only; battle-art-diag is opt-in via --scenario.
  const grepArgs = args.all ? ["--grep", `/${METRIC_SCENARIOS.join("|")}/`] : scenario ? ["--grep", scenario] : [];
  console.log(`\nProfiling → ${outDir}`);
  console.log(
    `Runtime: ${args.electron ? "electron" : "chromium"} | Trace: ${args.trace ? "yes" : "no"} | Scenario: ${args.all ? METRIC_SCENARIOS.join(",") : (scenario ?? "all")} | Runs: ${env.PERF_RUNS}`,
  );

  const result = spawnSync("npx", ["playwright", "test", "--config", "playwright.performance.config.ts", ...grepArgs], {
    cwd: root,
    stdio: "inherit",
    env,
  });

  const summaryPath = path.join(outDir, "summary.md");
  if (fs.existsSync(summaryPath)) {
    console.log(`\nReport: ${summaryPath}`);
  }

  process.exit(result.status ?? 1);
}

main();
