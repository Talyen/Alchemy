/**
 * Change amplification audit — reads git log, computes file-count stats + co-edit signal.
 * Run: node scripts/audit-change-amplification.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(currentFile), "..");
const TMP_ROOT = path.join(ROOT, ".tmp-audit");
const TMP_DIR = path.join(TMP_ROOT, String(process.pid));
fs.mkdirSync(TMP_DIR, { recursive: true });

function parseArgs(args) {
  const sincePrefix = "--since=";
  const sinceArg = args.find((arg) => arg.startsWith(sincePrefix));
  return {
    since: sinceArg ? sinceArg.slice(sincePrefix.length).replace(/^"|"$/g, "") : "3 months ago",
  };
}

const { since } = parseArgs(process.argv.slice(2));

function log(grep, out) {
  const r = spawnSync(
    "git",
    ["log", `--since=${since}`, `--grep=${grep}`, "--format=---%H|%s", "--name-only", "--no-merges"],
    { encoding: "buffer" },
  );
  if (r.status !== 0) {
    throw new Error(r.stderr.toString("utf8"));
  }
  fs.writeFileSync(out, r.stdout);
}

const PATHS = [
  ["feat", path.join(TMP_DIR, "feat.txt")],
  ["fix", path.join(TMP_DIR, "fix.txt")],
  ["balance", path.join(TMP_DIR, "balance.txt")],
];
for (const [g, p] of PATHS) log(`^${g}`, p);

function parse(file, type) {
  const buf = fs.readFileSync(file, "utf8");
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
        type,
      };
    } else if (line.trim() && cur) {
      cur.files.push(line.trim());
    }
  }
  if (cur) commits.push(cur);
  return commits;
}

function dedupeCommits(commitsToDedupe) {
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

const commits = dedupeCommits(PATHS.flatMap(([t, p]) => parse(p, t)));
const NOISE = /^(Raw Assets\/|public\/sounds\/|src\/assets\/optimized\/)/;
const EXTNOISE = /\.(ogg|wav|mp3|webp|jpeg|jpg|png|svg)$/;

const filtered = commits.filter((c) => {
  if (!c.files.length) return false;
  const codeFiles = c.files.filter((f) => !NOISE.test(f) && !EXTNOISE.test(f));
  if (!codeFiles.length) return false;
  return codeFiles.some((f) => /^(src\/|tests\/)/.test(f));
});

const mega = new Set(filtered.filter((c) => c.files.length >= 100).map((c) => c.hash));
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

function stats(arr) {
  const counts = arr.map((c) => c.files.length).sort((a, b) => a - b);
  if (!counts.length) return null;
  const mid = Math.floor(counts.length / 2);
  const median = counts.length % 2 ? counts[mid] : (counts[mid - 1] + counts[mid]) / 2;
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const p90 = counts[Math.floor(counts.length * 0.9)];
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

console.log(`Since: ${since}`);
console.log("Files-per-commit stats:");
for (const [name, arr] of [
  ["raw", commits],
  ["filtered", filtered],
  ["clean", clean],
]) {
  const s = stats(arr);
  console.log(`  ${name}: n=${s.n} median=${s.median} mean=${s.mean} p90=${s.p90} max=${s.max}`);
  console.log(`    buckets:`, JSON.stringify(s.buckets));
}

function printHotspots(arr, label) {
  const fc = new Map();
  for (const c of arr) for (const f of c.files) fc.set(f, (fc.get(f) || 0) + 1);
  const thr = Math.floor(arr.length * 0.25);
  console.log(`\n${label} hotspots (>= ${thr} = 25% of ${arr.length}):`);
  for (const [f, n] of [...fc.entries()].filter(([, n]) => n >= thr).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${f}`);
  }
  return fc;
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
  `\nCo-edit signal: ${coedit}/${clean.length} (${((coedit / clean.length) * 100).toFixed(0)}%) CLEAN commits touch both src/lib/game-data/* and a screens/* file`,
);

// Cleanup temp files
for (const [, p] of PATHS)
  try {
    fs.unlinkSync(p);
  } catch {
    /* file may not exist */
  }
try {
  fs.rmdirSync(TMP_DIR);
} catch {
  /* dir may not exist or non-empty */
}
try {
  fs.rmdirSync(TMP_ROOT);
} catch {
  /* dir may not exist or another audit may still be running */
}
