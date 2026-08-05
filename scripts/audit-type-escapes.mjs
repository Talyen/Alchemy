/**
 * Count typing escapes in non-test, non-generated authored source so trends
 * can be compared run-over-run. Interpret via docs/Audits/15-TypeSafetyAudit.md.
 * Run: node scripts/audit-type-escapes.mjs
 *
 * Trend instrumentation only — always exits 0. Counts are directional
 * (regex-based), not a lint gate; triage individual hits by risk.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(currentFile), "..");
const SRC = path.join(ROOT, "src");

const CATEGORIES = [
  { name: "any (annotations/casts)", regex: /(?::\s*any\b|\bas any\b|<any[,>]|\bany\[\])/g },
  { name: "as unknown as", regex: /\bas unknown as\b/g },
  {
    name: "suppressions (@ts-ignore / @ts-expect-error / eslint-disable)",
    regex: /@ts-ignore|@ts-expect-error|eslint-disable/g,
  },
  { name: "non-null assertions (!. / !;)", regex: /!\.(?=\w)|!\)|!;/g },
];

function isCounted(filePath) {
  if (!/\.(ts|tsx)$/.test(filePath)) return false;
  if (/\.(test|spec)\.(ts|tsx)$/.test(filePath)) return false;
  if (/\.generated\./.test(filePath)) return false;
  if (/\.d\.ts$/.test(filePath)) return false;
  return true;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      yield* walk(full);
    } else if (isCounted(full)) {
      yield full;
    }
  }
}

const totals = new Map(CATEGORIES.map((c) => [c.name, { count: 0, files: new Map() }]));
let fileCount = 0;

for (const file of walk(SRC)) {
  fileCount++;
  const text = readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  for (const category of CATEGORIES) {
    const matches = text.match(category.regex);
    if (!matches) continue;
    const bucket = totals.get(category.name);
    bucket.count += matches.length;
    bucket.files.set(rel, matches.length);
  }
}

console.log(`Type-escape trend counts (${fileCount} authored non-test files under src/):\n`);
for (const category of CATEGORIES) {
  const { count, files } = totals.get(category.name);
  console.log(`${category.name}: ${count}`);
  const top = [...files.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [rel, n] of top) console.log(`  ${n.toString().padStart(4)}  ${rel}`);
  console.log("");
}
console.log("Directional only — compare against the previous run; not a gate.");
