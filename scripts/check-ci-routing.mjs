#!/usr/bin/env node
/** Check the high-cost CI path filters remain present and explainable. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "ci.yml");
const DIAGNOSTIC_WORKFLOW_PATHS = [
  path.join(ROOT, ".github", "workflows", "ci.yml"),
  path.join(ROOT, ".github", "workflows", "nightly.yml"),
  path.join(ROOT, ".github", "workflows", "release.yml"),
];

export const CI_ROUTE_CONTRACTS = Object.freeze([
  {
    id: "save-gate",
    markers: ["save:", '"src/lib/validation/**"', '"src/features/alchemy/shared/storage/**"'],
  },
  {
    id: "desktop_renderer",
    markers: ["desktop_renderer:", '"src/features/alchemy/shell/**"', '"src/features/alchemy/run-loop/screens/**"'],
  },
  {
    id: "assets",
    markers: ["assets:", '"Raw Assets/**"', '"scripts/assets/**"', '"src/assets/optimized/**"'],
  },
]);

export function checkCiRouting(source) {
  return CI_ROUTE_CONTRACTS.flatMap((contract) =>
    contract.markers.filter((marker) => !source.includes(marker)).map((marker) => `${contract.id}: missing ${marker}`),
  );
}

function uploadArtifactBlocks(source) {
  const starts = [...source.matchAll(/^\s+- uses: actions\/upload-artifact@/gmu)].map((match) => match.index ?? 0);
  return starts.map((start, index) => source.slice(start, starts[index + 1] ?? source.length));
}

export function checkDiagnosticRetention(sources) {
  const failures = [];
  for (const [workflow, source] of Object.entries(sources)) {
    for (const block of uploadArtifactBlocks(source)) {
      if (!/(?:vitest-timings|playwright-report)/u.test(block)) continue;
      for (const marker of ["if: failure()", "retention-days: 7", "reports/current-run.*"]) {
        if (!block.includes(marker)) failures.push(`${workflow}: diagnostic upload missing ${marker}`);
      }
    }
  }
  return failures;
}

function main() {
  const source = fs.readFileSync(WORKFLOW_PATH, "utf8");
  const sources = Object.fromEntries(
    DIAGNOSTIC_WORKFLOW_PATHS.map((workflowPath) => [
      path.basename(workflowPath),
      fs.readFileSync(workflowPath, "utf8"),
    ]),
  );
  const failures = [...checkCiRouting(source), ...checkDiagnosticRetention(sources)];
  if (failures.length > 0) {
    console.error("CI routing checks failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`CI routing checks passed (${CI_ROUTE_CONTRACTS.length} high-cost filters).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
