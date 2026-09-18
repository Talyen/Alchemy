/**
 * Change amplification audit — reads git log, computes file-count stats + co-edit signal.
 * Run: node scripts/audit-change-amplification.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./lib/is-main-module.mjs";

const currentFile = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(currentFile), "..");

export function parseArgs(args) {
  const sincePrefix = "--since=";
  const sinceArg = args.find((arg) => arg.startsWith(sincePrefix));
  return {
    since: sinceArg ? sinceArg.slice(sincePrefix.length).replace(/^"|"$/g, "") : "3 months ago",
  };
}

function loadLog({ since, rootDir = ROOT }) {
  const result = spawnSync(
    "git",
    [
      "--no-pager",
      "log",
      `--since=${since}`,
      "--grep=^feat",
      "--grep=^fix",
      "--grep=^balance",
      "--format=---%H|%s",
      "--name-only",
      "--no-merges",
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
      env: { ...process.env, GIT_PAGER: "cat", GIT_TERMINAL_PROMPT: "0" },
    },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || "git log failed");
  }
  return result.stdout;
}

export function parse(buf) {
  const commits = [];
  let cur = null;
  for (const line of buf.split(/\r?\n/)) {
    if (line.startsWith("---")) {
      if (cur) commits.push(cur);
      const rest = line.slice(3);
      const i = rest.indexOf("|");
      cur = {
        hash: rest.slice(0, i),
        subject: rest.slice(i + 1),
        files: [],
      };
    } else if (line.trim() && cur) {
      cur.files.push(line.trim());
    }
  }
  if (cur) commits.push(cur);
  return commits;
}

export function dedupeCommits(commitsToDedupe) {
  const byHash = new Map();
  for (const commit of commitsToDedupe) {
    if (!byHash.has(commit.hash)) {
      byHash.set(commit.hash, {
        ...commit,
        files: [...new Set(commit.files)],
      });
    }
  }
  return [...byHash.values()];
}

export const NOISE = /^(CHANGELOG\.md|Raw Assets\/|public\/sounds\/|src\/assets\/optimized\/)/;
export const EXTNOISE = /\.(ogg|wav|mp3|webp|jpeg|jpg|png|svg)$/;
// A single huge import dwarfs per-commit stats, so mega-commits are reported
// separately from the clean signal. Test-only fix batches are excluded the
// same way: they touch many files without changing game behavior.
export const MEGA_COMMIT_FILES = 100;
export const HOTSPOT_COVERAGE_FRACTION = 0.25;
export const HOTSPOT_MIN_COUNT = 2;

export function stats(arr) {
  const counts = arr.map((c) => c.files.length).sort((a, b) => a - b);
  if (!counts.length) return null;
  const mid = Math.floor(counts.length / 2);
  const median = counts.length % 2 ? counts[mid] : (counts[mid - 1] + counts[mid]) / 2;
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const p90 = counts[Math.min(counts.length - 1, Math.floor(counts.length * 0.9))];
  const buckets = { "<=3": 0, "4-5": 0, "6-8": 0, "9-12": 0, "13-20": 0, ">20": 0 };
  for (const n of counts) {
    if (n <= 3) buckets["<=3"]++;
    else if (n <= 5) buckets["4-5"]++;
    else if (n <= 8) buckets["6-8"]++;
    else if (n <= 12) buckets["9-12"]++;
    else if (n <= 20) buckets["13-20"]++;
    else buckets[">20"]++;
  }
  return {
    n: counts.length,
    median,
    mean: +mean.toFixed(1),
    p90,
    max: counts[counts.length - 1],
    buckets,
  };
}

export function printHotspots(arr, label) {
  const fc = new Map();
  for (const c of arr) for (const f of c.files) fc.set(f, (fc.get(f) || 0) + 1);
  const thr = Math.max(HOTSPOT_MIN_COUNT, Math.ceil(arr.length * HOTSPOT_COVERAGE_FRACTION));
  console.log(`\n${label} hotspots (>= ${thr} = at least 25% of ${arr.length}, minimum 2):`);
  for (const [f, n] of [...fc.entries()].filter(([, n]) => n >= thr).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${f}`);
  }
  return fc;
}

export function runAmplification({ since, rootDir = ROOT } = {}) {
  const resolvedSince = since ?? parseArgs(process.argv.slice(2)).since;
  const commits = dedupeCommits(parse(loadLog({ since: resolvedSince, rootDir })));

  const filtered = commits
    .map((c) => ({
      ...c,
      files: c.files.filter((f) => !NOISE.test(f) && !EXTNOISE.test(f)),
    }))
    .filter((c) => c.files.length > 0 && c.files.some((f) => /^(src\/|tests\/)/.test(f)));

  const mega = new Set(filtered.filter((c) => c.files.length >= MEGA_COMMIT_FILES).map((c) => c.hash));
  const testBatch = new Set(
    filtered
      .filter(
        (c) =>
          /^fix\(tests\)/.test(c.subject) &&
          c.files.every((f) => f.startsWith("tests/") || /(\.json|\.cjs|\.mjs|\.js|\.yml|CHANGELOG\.md)$/.test(f)),
      )
      .map((c) => c.hash),
  );
  const clean = filtered.filter((c) => !mega.has(c.hash) && !testBatch.has(c.hash));

  console.log(`Since: ${resolvedSince}`);
  console.log("Files-per-commit stats:");
  for (const [name, arr] of [
    ["raw", commits],
    ["filtered", filtered],
    ["clean", clean],
  ]) {
    const s = stats(arr);
    if (!s) {
      console.log(`  ${name}: n=0 (no commits in window)`);
      continue;
    }
    console.log(`  ${name}: n=${s.n} median=${s.median} mean=${s.mean} p90=${s.p90} max=${s.max}`);
    console.log(`    buckets:`, JSON.stringify(s.buckets));
  }

  printHotspots(clean, "CLEAN");

  console.log("\nsrc/lib/game-data/* hotspots in CLEAN:");
  const gd = new Map();
  for (const c of clean)
    for (const f of c.files) {
      if (f.startsWith("src/lib/game-data/") && !EXTNOISE.test(f)) {
        gd.set(f, (gd.get(f) || 0) + 1);
      }
    }
  for (const [f, n] of [...gd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${String(n).padStart(4)}  ${f}`);
  }

  let coedit = 0;
  for (const c of clean) {
    let hasGD = false;
    let hasScreen = false;
    for (const f of c.files) {
      if (f.startsWith("src/lib/game-data/") && !EXTNOISE.test(f)) hasGD = true;
      if (f.includes("/screens/") && f.startsWith("src/")) hasScreen = true;
    }
    if (hasGD && hasScreen) coedit++;
  }
  console.log(
    `\nCo-edit signal: ${coedit}/${clean.length} (${clean.length ? ((coedit / clean.length) * 100).toFixed(0) : "0"}%) CLEAN commits touch both src/lib/game-data/* and a screens/* file`,
  );
  return { commits, filtered, clean };
}

if (isMainModule(import.meta.url)) runAmplification();
