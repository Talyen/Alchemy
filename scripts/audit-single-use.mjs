/**
 * Single-use abstraction audit — counts exports that have exactly one call site.
 * Run: node scripts/audit-single-use.mjs
 *
 * Scans `src/**` for `export function|const|class|interface|type` declarations,
 * then for each name counts non-definition references across the same tree.
 * Excludes generated, test, and declaration files.
 *
 * Counterweight to the complexity / file-length / coupling audits (#2, #4, #5 in
 * PROMPTS.md): only abstractions with ≥ 2 distinct call sites survive review.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\//, "");
const SRC = path.join(ROOT, "src");

const SKIP_DIRS = new Set(["node_modules", "dist", "release-desktop", ".vite", "coverage", "reports"]);
const SKIP_FILE_RE = /\.(test|spec)\.(ts|tsx)$|metadata\.generated\.ts|assets\.generated\.ts|\.d\.ts$/;

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(p));
    else if (/\.(ts|tsx)$/.test(entry.name) && !SKIP_FILE_RE.test(entry.name)) out.push(p);
  }
  return out;
}

const files = listFiles(SRC);
const fileText = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));

// Match exported declarations. Captures the exported name.
const DECL_RE =
  /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^export\s+const\s+([A-Za-z_$][\w$]*)|^export\s+class\s+([A-Za-z_$][\w$]*)|^export\s+interface\s+([A-Za-z_$][\w$]*)|^export\s+type\s+([A-Za-z_$][\w$]*)/gm;

const defs = new Map();
for (const [file, text] of fileText) {
  for (const m of text.matchAll(DECL_RE)) {
    const name = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5];
    if (!name) continue;
    if (!defs.has(name)) defs.set(name, []);
    defs.get(name).push(file);
  }
}

function countRefs(name) {
  // Word-boundary match; exclude the export declaration line itself.
  const re = new RegExp(`\\b${name}\\b`, "g");
  let refs = 0;
  let defHits = 0;
  for (const [, text] of fileText) {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0;
      if (!re.test(lines[i])) continue;
      re.lastIndex = 0;
      if (DECL_RE.test(lines[i])) {
        defHits++;
        continue;
      }
      refs++;
    }
  }
  return { refs, defs: defHits };
}

const allDefs = [...defs.entries()];
let total = 0;
let single = 0;
const offenders = [];

for (const [name, defSites] of allDefs) {
  const { refs, defs: defHits } = countRefs(name);
  total++;
  // "Single use" = exactly one call site beyond the definition. Multiple
  // re-exports (`export { foo } from ...`) inflate refs without counting as
  // callers, so we subtract 1 reference per definition site to get an
  // approximate "external callers" count.
  const externalRefs = Math.max(0, refs - defHits);
  if (externalRefs <= 1) {
    single++;
    if (defSites.length === 1) {
      offenders.push({ name, file: path.relative(ROOT, defSites[0]), refs: externalRefs });
    }
  }
}

const ratio = total ? single / total : 0;
console.log(`Single-use abstraction audit (src/**, excluding tests + generated)`);
console.log(`  total exports scanned:  ${total}`);
console.log(`  single-use (≤ 1 caller): ${single}`);
console.log(`  ratio:                  ${(ratio * 100).toFixed(1)}%`);
console.log(`  target:                 < 15%`);
console.log(`  status:                 ${ratio < 0.15 ? "OK" : "REVIEW"}`);
if (offenders.length) {
  const TOP = 25;
  console.log(`\nTop single-use abstractions (showing up to ${TOP}):`);
  for (const o of offenders.slice(0, TOP)) {
    console.log(`  ${String(o.refs).padStart(2)} caller  ${o.name}  (${o.file})`);
  }
  if (offenders.length > TOP) console.log(`  ... and ${offenders.length - TOP} more`);
}

process.exit(ratio < 0.15 ? 0 : 1);
