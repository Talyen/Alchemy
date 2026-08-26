#!/usr/bin/env node
/** Check the high-cost CI path filters remain present and explainable. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "./lib/is-main-module.mjs";
import { ROUTES } from "./lib/change-routes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIAGNOSTIC_WORKFLOW_PATHS = [
  path.join(ROOT, ".github", "workflows", "ci.yml"),
  path.join(ROOT, ".github", "workflows", "nightly.yml"),
  path.join(ROOT, ".github", "workflows", "release.yml"),
];

/** Focused E2E gates whose CI filters must include every matching change-route pattern. */
export const FOCUSED_E2E_ROUTE_IDS = Object.freeze(["shop", "gear", "mystery", "audio"]);

export const CI_ROUTE_CONTRACTS = Object.freeze([
  {
    id: "save-gate",
    markers: ["save:", '"src/lib/validation/**"', '"src/features/alchemy/shared/storage/**"'],
  },
  {
    id: "shop-gate",
    markers: [
      "shop:",
      '"src/features/alchemy/run-loop/shop/**"',
      '"src/features/alchemy/run-loop/screens/*shop*"',
      '"src/features/alchemy/shell/use-shop-controller.ts"',
      '"src/lib/alchemist/**"',
      '"tests/shop-and-rewards.spec.ts"',
    ],
  },
  {
    id: "gear-gate",
    markers: [
      "gear:",
      '"src/lib/gear/**"',
      '"src/features/alchemy/meta/screens/armory/**"',
      '"src/features/alchemy/meta/screens/armory-screen.tsx"',
      '"src/features/alchemy/shared/stores/gear-*.ts"',
      '"tests/armory.spec.ts"',
    ],
  },
  {
    id: "mystery-gate",
    markers: [
      "mystery:",
      '"src/lib/mystery/**"',
      '"src/lib/active-run-session/mystery-visit-persistence.ts"',
      '"src/features/alchemy/run-loop/navigation/*mystery*"',
      '"src/features/alchemy/run-loop/screens/mystery/**"',
      '"src/app/screen-routes/mystery-screen-route.tsx"',
      '"src/features/alchemy/shell/use-mystery-event-navigation.ts"',
      '"tests/destination-progression.spec.ts"',
    ],
  },
  {
    id: "audio-gate",
    markers: [
      "audio:",
      '"src/lib/audio*.ts"',
      '"src/lib/sound-registry.ts"',
      '"public/sounds/**"',
      '"tests/audio-sfx.spec.ts"',
    ],
  },
  {
    id: "desktop_renderer",
    markers: ["desktop_renderer:", '"src/features/alchemy/shell/**"', '"src/features/alchemy/run-loop/screens/**"'],
  },
  {
    id: "assets",
    markers: [
      "assets:",
      '"Raw Assets/**"',
      '"scripts/assets/**"',
      '"scripts/check-prepared-assets.mjs"',
      '"scripts/prepare-assets.mjs"',
      '"scripts/optimize-assets.mjs"',
      '"scripts/optimize-music.mjs"',
      '"scripts/optimize-sounds.mjs"',
      '"scripts/sync-assets.mjs"',
      '"scripts/sync-gear-art.mjs"',
      '"scripts/lib/asset-manifest-cache.mjs"',
      '"scripts/lib/audio-optimizer.mjs"',
      '"src/assets/optimized/**"',
    ],
  },
]);

export const CI_JOB_CONTRACTS = Object.freeze([
  { id: "changes", needs: [] },
  { id: "assets", needs: ["changes"] },
  { id: "save-gate", needs: ["changes"] },
  { id: "shop-gate", needs: ["changes"] },
  { id: "gear-gate", needs: ["changes"] },
  { id: "mystery-gate", needs: ["changes"] },
  { id: "audio-gate", needs: ["changes"] },
  { id: "desktop-build", needs: ["changes"] },
  { id: "electron-e2e", needs: ["changes", "ship-gate"] },
]);

export function checkCiRouting(source) {
  return CI_ROUTE_CONTRACTS.flatMap((contract) =>
    contract.markers.filter((marker) => !source.includes(marker)).map((marker) => `${contract.id}: missing ${marker}`),
  );
}

/** Fail when a focused E2E change-route pattern is absent from the CI path filter. */
export function checkChangeRoutePatternsInCi(source, routes = ROUTES) {
  return FOCUSED_E2E_ROUTE_IDS.flatMap((id) => {
    const route = routes.find((entry) => entry.id === id);
    if (!route) return [`${id}: missing change-route`];
    return route.patterns
      .filter((pattern) => !source.includes(`"${pattern}"`))
      .map((pattern) => `${id}: CI filter missing "${pattern}"`);
  });
}

export function checkJobBoundaries(source) {
  const failures = [];
  for (const contract of CI_JOB_CONTRACTS) {
    const jobPattern = new RegExp(String.raw`^ {2}${contract.id}:\s*$`, "mu");
    const match = jobPattern.exec(source);
    if (!match) {
      failures.push(`${contract.id}: missing job boundary`);
      continue;
    }
    const start = match.index;
    const nextJob = /^ {2}[A-Za-z0-9_-]+:\s*$/gmu;
    nextJob.lastIndex = start + match[0].length;
    const next = nextJob.exec(source);
    const block = source.slice(start, next?.index ?? source.length);
    for (const dependency of contract.needs) {
      if (!new RegExp(String.raw`needs:\s*(?:\[[^\]]*\b${dependency}\b[^\]]*\]|${dependency})`, "u").test(block)) {
        failures.push(`${contract.id}: missing needs dependency ${dependency}`);
      }
    }
  }
  return failures;
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
      for (const marker of ["if: failure()", "retention-days: 7", "reports/current-run.*", "reports/runs/"]) {
        if (!block.includes(marker)) failures.push(`${workflow}: diagnostic upload missing ${marker}`);
      }
    }
  }
  return failures;
}

function main() {
  const sources = Object.fromEntries(
    DIAGNOSTIC_WORKFLOW_PATHS.map((workflowPath) => [
      path.basename(workflowPath),
      fs.readFileSync(workflowPath, "utf8"),
    ]),
  );
  const source = sources["ci.yml"];
  const failures = [
    ...checkCiRouting(source),
    ...checkChangeRoutePatternsInCi(source),
    ...checkJobBoundaries(source),
    ...checkDiagnosticRetention(sources),
  ];
  if (failures.length > 0) {
    console.error("CI routing checks failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `CI routing checks passed (${CI_ROUTE_CONTRACTS.length} filters, ${CI_JOB_CONTRACTS.length} job boundaries).`,
  );
}

if (isMainModule(import.meta.url)) main();
