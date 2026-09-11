import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { resolveRoutes, SHARED_BUILD_PATTERNS } from "../../scripts/lib/change-routes.mjs";
import { globToRegExp } from "../../scripts/lib/glob-pattern.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/**
 * CI topology is owned by .github/workflows/ while local selection is owned by
 * scripts/lib/change-routes.mjs (see CONTRIBUTING.md#static-build-and-ci-policy).
 * Neither generates the other, so this test pins their documented relationship:
 * every local route that implies a path-gated CI job must match that job's
 * paths-filter, and representative paths must land on both sides together.
 * Update the cases below deliberately when either side changes intent.
 */
function readCiFilters() {
  const lines = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8").split("\n");
  const start = lines.findIndex((line) => line.trim() === "filters: |");
  expect(start).toBeGreaterThan(-1);
  const filtersIndent = lines[start].indexOf("filters:");
  const filters = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if ((line.match(/^\s*/) ?? [""])[0].length <= filtersIndent) break;
    const gate = line.match(/^\s+([A-Za-z_]+):\s*$/)?.[1];
    if (gate) {
      current = gate;
      filters.set(gate, []);
      continue;
    }
    const pattern = line.match(/^\s+-\s+"([^"]+)"\s*$/)?.[1];
    if (pattern && current) filters.get(current)?.push(pattern);
  }
  return filters;
}

function ciGatesFor(filters: Map<string, string[]>, filePath: string): string[] {
  return [...filters.entries()]
    .filter(([, patterns]) => patterns.some((pattern) => globToRegExp(pattern).test(filePath)))
    .map(([gate]) => gate);
}

// [changed path, expected local route ids, expected CI filter gates]
// Empty gates means the change is covered by ungated every-push jobs
// (lint/test/build/critical e2e), not a path-gated job.
const PATH_CASES: Array<[string, string[], string[]]> = [
  ["src/features/alchemy/shared/storage/io.ts", ["runtime", "save"], ["save", "desktop", "desktop_renderer"]],
  ["src/features/alchemy/shared/stores/run-store.ts", ["runtime", "save"], ["save", "desktop_renderer"]],
  ["src/lib/validation/save-schemas/save-data.ts", ["runtime", "save"], ["save"]],
  ["src/lib/content-validation/validators.ts", ["runtime", "save"], ["save"]],
  ["src/lib/active-run-session/session.ts", ["runtime", "save"], ["save"]],
  ["src/app/use-app-save-state.ts", ["runtime", "save"], ["save", "desktop_renderer"]],
  // Save specs intentionally run nothing locally (browser-test has no commands;
  // local handoff does not rerun browser journeys) while CI runs the save gate.
  ["tests/e2e/specs/save-persistence.spec.ts", ["browser-test"], ["save"]],
  ["scripts/sync-generated.mjs", ["assets", "tooling"], ["assets"]],
  ["scripts/prepare-assets.mjs", ["assets", "tooling"], ["assets", "desktop_renderer"]],
  ["scripts/sync-art-barrels.mjs", ["assets", "tooling"], ["assets"]],
  // Release/desktop sync helpers share the sync-* prefix but reproduce no
  // committed asset output: tooling route only, no CI gate.
  ["scripts/sync-changelog.mjs", ["tooling"], []],
  ["scripts/sync-steam-appid.mjs", ["tooling"], ["desktop"]],
  ["desktop/main.cjs", ["desktop"], ["desktop", "desktop_renderer"]],
  ["src/lib/platform.ts", ["desktop", "runtime"], ["save", "desktop", "desktop_renderer"]],
  ["src/App.tsx", ["runtime"], ["desktop_renderer"]],
  ["src/app/app-shell.ts", ["runtime"], ["desktop_renderer"]],
  ["src/lib/battle/damage-calc.ts", ["runtime"], []],
  ["vite.config.ts", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/build-verified.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/vite-chunks.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/sentry-release.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["package.json", ["tooling"], ["save", "desktop", "desktop_renderer", "assets"]],
  ["docs/REFERENCE.md", ["documentation"], []],
];

describe("CI path-filter parity", () => {
  it("keeps local routes and CI gates aligned on representative paths", () => {
    const filters = readCiFilters();
    expect([...filters.keys()]).toEqual(["save", "desktop", "desktop_renderer", "assets"]);
    for (const [filePath, routeIds, gates] of PATH_CASES) {
      expect(
        resolveRoutes([filePath])
          .map((route) => route.id)
          .sort(),
        `routes:${filePath}`,
      ).toEqual([...routeIds].sort());
      expect(ciGatesFor(filters, filePath).sort(), `gates:${filePath}`).toEqual([...gates].sort());
    }
  });

  it("covers every shared build input with a desktop-family CI gate", () => {
    const filters = readCiFilters();
    const desktop = new Set([...(filters.get("desktop") ?? []), ...(filters.get("desktop_renderer") ?? [])]);
    for (const pattern of SHARED_BUILD_PATTERNS) {
      const covered = [...desktop].some(
        (filter) => filter === pattern || globToRegExp(filter).test(pattern.replaceAll("*", "x")),
      );
      expect(covered, `shared build input:${pattern}`).toBe(true);
    }
  });
});
