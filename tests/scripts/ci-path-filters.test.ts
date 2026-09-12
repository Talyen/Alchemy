import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
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
  ["scripts/smoke-desktop.ps1", ["desktop", "tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/release-checks.mjs", ["desktop", "tooling"], ["desktop", "desktop_renderer"]],
  ["desktop/main.cjs", ["desktop"], ["desktop", "desktop_renderer"]],
  ["src/lib/platform.ts", ["desktop", "runtime"], ["save", "desktop", "desktop_renderer"]],
  ["src/App.tsx", ["runtime"], ["desktop_renderer"]],
  ["src/app/app-shell.ts", ["runtime"], ["desktop_renderer"]],
  ["src/lib/battle/damage-calc.ts", ["runtime"], []],
  ["vite.config.ts", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/build-verified.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/vite-chunks.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/sentry-release.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/desktop-build-config.mjs", ["desktop", "tooling"], ["desktop", "desktop_renderer"]],
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

describe("desktop CI artifact flow", () => {
  const workflow = readFileSync(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8");
  const packaging = workflow.split("  desktop-build:\n")[1].split("  electron-e2e:\n")[0];
  const condition = packaging.split("    if: >-\n")[1].split("    runs-on:")[0].trim();

  it("restores installed Electron binaries only from exact dependency caches", () => {
    const electron = workflow.split("  electron-e2e:\n")[1];
    expect(electron).toContain("key: electron-${{ runner.os }}-${{ hashFiles('package-lock.json') }}");
    expect(electron).not.toContain("restore-keys:");
    expect(electron).toContain("node scripts/ensure-electron.mjs");
  });

  it("checks renderer budgets before packaging and retains verified releases before Steam upload", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["dist:desktop"].split(" && ")).toEqual([
      "npm run sync:steam-appid",
      "npm run build:desktop",
      "npm run check:bundle",
      "node scripts/dist-desktop.mjs",
    ]);
    expect(packaging.indexOf("npm run check:bundle")).toBeGreaterThan(packaging.indexOf("npm run build:desktop"));
    expect(packaging.indexOf("npm run check:bundle")).toBeLessThan(packaging.indexOf("node scripts/dist-desktop.mjs"));
    const release = readFileSync(path.join(repoRoot, ".github/workflows/release.yml"), "utf8")
      .split("  package:\n")[1]
      .split("  release:\n")[0];
    expect(release).toContain("npm run dist:desktop");
    expect(release).not.toContain("npm run check:bundle");
    const retained = release.indexOf("- name: Retain verified release package");
    expect(retained).toBeGreaterThan(release.indexOf("npm run smoke:desktop"));
    const upload = release.slice(retained);
    expect(upload).toContain("uses: actions/upload-artifact@v7");
    expect(upload).toContain("name: release-package-${{ github.ref_name }}-${{ github.run_attempt }}");
    expect(upload).toContain("release-desktop/");
    expect(upload).toContain("release-notes/${{ github.ref_name }}.md");
    expect(upload).toContain("retention-days: 7");
    expect(upload).toContain("compression-level: 0");
    expect(upload).toContain("if-no-files-found: error");
    expect(upload).not.toContain("if: always()");
  });

  it("publishes the producer artifact by ID without rebuilding on a delivery retry", () => {
    const releaseWorkflow = readFileSync(path.join(repoRoot, ".github/workflows/release.yml"), "utf8");
    const producer = releaseWorkflow.split("  package:\n")[1].split("  release:\n")[0];
    const delivery = releaseWorkflow.split("  release:\n")[1];
    expect(producer).toContain("artifact-id: ${{ steps.package-upload.outputs.artifact-id }}");
    expect(producer).toContain("id: package-upload");
    expect(delivery).toContain("needs: package");
    expect(delivery).toContain("artifact-ids: ${{ needs.package.outputs.artifact-id }}");
    expect(delivery).toContain("merge-multiple: true");
    expect(delivery).not.toContain("github.run_attempt");
    expect(delivery).not.toContain("npm run dist:desktop");
    expect(delivery.indexOf("actions/download-artifact")).toBeLessThan(delivery.indexOf("- name: Steam upload"));
  });

  it.each(["ci", "release", "nightly"])("keeps music in %s browser artifacts", (name) => {
    const contents = readFileSync(path.join(repoRoot, `.github/workflows/${name}.yml`), "utf8");
    expect(contents).not.toContain("!dist/Music/");
    expect(contents).toContain("Smoke test downloaded build including music");
  });

  it.each([
    ["success", "success", true, false, true],
    ["success", "skipped", true, false, true],
    ["success", "failure", true, false, false],
    ["success", "cancelled", true, false, false],
    ["failure", "skipped", true, false, false],
    ["success", "success", true, true, false],
    ["success", "skipped", false, false, false],
  ])(
    "runs packaging only when its prerequisites permit it (%s, %s)",
    (changes, renderer, selected, cancelled, expected) => {
      // Without a status function, GitHub implicitly requires all needs to succeed.
      expect(condition).toContain("!cancelled()");
      const actual = runInNewContext(condition.replaceAll("needs.ship-gate", "needs.renderer"), {
        cancelled: () => cancelled,
        github: { event_name: "push" },
        needs: { changes: { result: changes, outputs: { desktop: String(selected) } }, renderer: { result: renderer } },
      });
      expect(actual).toBe(expected);
    },
  );

  it("preserves music in the shared packaging artifact and gates publishing on package startup", () => {
    const renderer = workflow.split("  ship-gate:\n")[1].split("  assets:\n")[0];
    expect(renderer).not.toContain("!dist/Music/");
    expect(renderer).toContain("npm run check:bundle");
    expect(packaging.indexOf("npm run smoke:desktop")).toBeGreaterThan(
      packaging.indexOf("node scripts/dist-desktop.mjs"),
    );
    const release = readFileSync(path.join(repoRoot, ".github/workflows/release.yml"), "utf8");
    expect(release).toContain("npm run smoke:desktop");
    expect(release.indexOf("npm run smoke:desktop")).toBeLessThan(release.indexOf("- name: Steam upload"));
  });
});
