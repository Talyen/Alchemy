import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { stringify, parse } from "yaml";
import { readWorkflow, workflowJob } from "../helpers/workflow";

import { resolveRoutes, SHARED_BUILD_PATTERNS } from "../../scripts/lib/verification/change-routes.mjs";
import { globToRegExp } from "../../scripts/lib/glob-pattern.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

it("CI action dependencies pins external actions in workflows and composite actions to full commit SHAs", () => {
  const references = [".github/workflows", ".github/actions"].flatMap((directory) => {
    const root = path.join(repoRoot, directory);
    return readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.ya?ml$/u.test(file))
      .flatMap((file) => {
        const contents = readFileSync(path.join(root, file), "utf8");
        return [...contents.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gmu)].map((match) => ({
          file: path.join(directory, file),
          reference: match[1],
        }));
      });
  });
  expect(references.length).toBeGreaterThan(0);
  for (const { file, reference } of references) {
    if (reference.startsWith("./")) continue;
    expect(reference, `${file}: ${reference}`).toMatch(/^[^@\s]+@[a-f0-9]{40}$/u);
  }
});

/**
 * CI topology is owned by .github/workflows/ while local selection is owned by
 * scripts/lib/verification/change-routes.mjs (see CONTRIBUTING.md#static-build-and-ci-policy).
 * Neither generates the other, so this test pins their documented relationship:
 * every local route that implies a path-gated CI job must match that job's
 * paths-filter, and representative paths must land on both sides together.
 * Update the cases below deliberately when either side changes intent.
 */
function readCiFilters(): Map<string, string[]> {
  const filter = readWorkflow("ci").jobs.changes.steps.find((step) => step.id === "filter")!;
  return new Map(Object.entries(parse(String(filter.with!.filters)) as Record<string, string[]>));
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
  ["src/features/alchemy/shared/storage/io.ts", ["interactions", "runtime", "save"], ["desktop", "desktop_renderer"]],
  ["src/features/alchemy/shared/stores/run-store.ts", ["interactions", "runtime", "save"], ["desktop_renderer"]],
  ["src/lib/validation/save-schemas/save-data.ts", ["runtime", "save"], []],
  ["src/lib/content-validation/validators.ts", ["runtime", "save"], []],
  ["src/lib/active-run-session/session.ts", ["runtime", "save"], []],
  ["src/app/use-app-save-state.ts", ["interactions", "runtime", "save"], ["desktop_renderer"]],
  ["src/app/autosave-lifecycle.ts", ["interactions", "runtime", "save"], ["desktop_renderer"]],
  // Save specs intentionally run nothing locally (browser-test has no commands;
  // local handoff does not rerun browser journeys) while CI runs every-push unit and critical browser coverage.
  ["tests/e2e/specs/save-persistence.spec.ts", ["browser-test"], ["desktop_renderer"]],
  ["scripts/sync-generated.mjs", ["assets", "tooling"], ["assets"]],
  ["scripts/prepare-assets.mjs", ["assets", "tooling"], ["assets", "desktop_renderer"]],
  ["scripts/check-prepared-assets.mjs", ["assets", "tooling"], ["assets"]],
  ["scripts/generate-icons.mjs", ["assets", "tooling"], ["assets"]],
  ["desktop/icons/icon.png", ["assets", "desktop"], ["assets", "desktop", "desktop_renderer"]],
  ["public/icon-512.png", ["assets", "runtime"], ["assets"]],
  ["scripts/sync-art-barrels.mjs", ["assets", "tooling"], ["assets"]],
  ["scripts/assets/optimize-pipelines.mjs", ["assets", "tooling"], ["assets"]],
  // Release/desktop sync helpers share the sync-* prefix but reproduce no
  // committed asset output: tooling route only, no CI gate.
  ["scripts/sync-changelog.mjs", ["tooling"], []],
  ["scripts/sync-steam-appid.mjs", ["tooling"], ["desktop"]],
  ["scripts/ensure-steamworks.mjs", ["desktop", "tooling"], ["desktop"]],
  ["scripts/steamworks/overlay.patch", ["desktop", "tooling"], ["desktop"]],
  ["scripts/steamworks/availability.patch", ["desktop", "tooling"], ["desktop"]],
  ["scripts/smoke-desktop.ps1", ["desktop", "tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/release/release-checks.mjs", ["desktop", "tooling"], ["desktop", "desktop_renderer"]],
  ["desktop/main.cjs", ["desktop"], ["desktop", "desktop_renderer"]],
  ["src/lib/platform.ts", ["desktop", "runtime"], ["desktop", "desktop_renderer"]],
  ["public/startup-preferences.js", ["runtime"], ["desktop", "desktop_renderer"]],
  ["src/App.tsx", ["runtime"], ["desktop_renderer"]],
  ["src/app/app-shell.ts", ["interactions", "runtime"], ["desktop_renderer"]],
  ["src/lib/battle/damage-calc.ts", ["runtime"], ["desktop_renderer"]],
  ["src/features/alchemy/run-loop/battle/battle-card-play.ts", ["interactions", "runtime"], ["desktop_renderer"]],
  ["src/lib/preload/image.ts", ["interactions", "runtime"], ["desktop_renderer"]],
  ["src/lib/platform-save-backend.ts", ["interactions", "runtime", "save"], ["desktop_renderer"]],
  ["tests/interaction/battle.dom.test.tsx", ["interactions", "unit-test"], ["desktop_renderer"]],
  ["vite.config.ts", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/build-verified.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/check-bundle-budget.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/verification/bundle-budget.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  [".node-version", ["tooling"], ["desktop", "desktop_renderer", "assets"]],
  [".npmrc", ["tooling"], ["desktop", "desktop_renderer", "assets"]],
  ["scripts/lib/command-invocation.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/run-command.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/repo-package.mjs", ["assets", "tooling"], ["assets", "desktop", "desktop_renderer"]],
  ["scripts/lib/script-run.mjs", ["assets", "tooling"], ["assets", "desktop", "desktop_renderer"]],
  ["scripts/lib/map-pool.mjs", ["assets", "tooling"], ["assets"]],
  ["scripts/lib/write-text-if-changed.mjs", ["assets", "tooling"], ["assets"]],
  ["scripts/lib/cli-args.mjs", ["assets", "tooling"], ["assets"]],
  ["scripts/lib/is-main-module.mjs", ["assets", "tooling"], ["assets", "desktop", "desktop_renderer"]],
  ["scripts/lib/repository-paths.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/vite-chunks.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/release/sentry-release.mjs", ["tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/release/desktop-build-config.mjs", ["desktop", "tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/release/desktop-artifact.mjs", ["desktop", "tooling"], ["desktop", "desktop_renderer"]],
  ["scripts/lib/release/game-edition.mjs", ["desktop", "tooling"], ["desktop", "desktop_renderer"]],
  ["game-edition.mjs", ["desktop", "tooling"], ["desktop", "desktop_renderer"]],
  ["package.json", ["tooling"], ["desktop", "desktop_renderer", "assets"]],
  ["Docs/SIMULATION.md", ["documentation"], []],
];

describe("CI path-filter parity", () => {
  it("keeps local routes and CI gates aligned on representative paths", () => {
    const filters = readCiFilters();
    expect([...filters.keys()]).toEqual(["desktop", "desktop_renderer", "assets"]);
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
  const packaging = workflowJob("ci", "desktop-build");
  const commands = (workflow: string, job: string) =>
    workflowJob(workflow, job).steps.flatMap((step) => (step.run ? [step.run] : []));

  it("restores installed Electron binaries only from exact dependency caches", () => {
    const electron = workflowJob("ci", "electron-e2e");
    const cache = electron.steps.find((step) => step.id === "electron-binary-cache")!;
    expect(cache.with?.key).toBe("electron-${{ runner.os }}-${{ hashFiles('package-lock.json') }}");
    expect(cache.with).not.toHaveProperty("restore-keys");
    expect(commands("ci", "electron-e2e")).toContain("node scripts/ensure-electron.mjs");
    const nightly = workflowJob("nightly", "ship-gate-full");
    expect(readWorkflow("nightly").jobs["ship-gate-full"].with).toMatchObject({
      full: true,
      renderer: "",
      timeout: 45,
    });
    expect(nightly.steps).toContainEqual(
      expect.objectContaining({
        uses: expect.stringMatching(/^actions\/checkout@/u),
        if: "inputs.full",
        with: { "fetch-depth": 0 },
      }),
    );
    expect(nightly.steps).toContainEqual(
      expect.objectContaining({ run: "npm run check:ship", if: "${{ inputs.full }}" }),
    );
    expect(nightly.steps).toContainEqual(
      expect.objectContaining({
        if: "inputs.full",
        env: expect.objectContaining({ ALCHEMY_INTERACTION_TIER: "nightly" }),
      }),
    );
  });

  it("checks renderer budgets before packaging and retains verified releases before Steam upload", () => {
    const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["dist:desktop"]).toBe("node scripts/dist-desktop.mjs --build");
    const steps = commands("ci", "desktop-build");
    expect(steps.indexOf("npm run check:bundle")).toBeGreaterThan(steps.indexOf("npm run build:desktop"));
    expect(steps.indexOf("npm run check:bundle")).toBeLessThan(steps.indexOf("node scripts/dist-desktop.mjs"));
    for (const [job, suffix] of [
      ["package", ""],
      ["package-demo", "-demo"],
    ]) {
      const producer = workflowJob("release", job);
      const upload = producer.steps.find((step) => step.id === "package-upload")!;
      expect(readWorkflow("release").jobs[job].with?.edition ?? "full").toBe(suffix ? "demo" : "full");
      expect(upload.with?.name).toBe(
        "release-package${{ inputs.edition == 'demo' && '-demo' || '' }}-${{ github.ref_name }}-${{ github.run_attempt }}",
      );
      expect(commands("release", job)).toContain("npm run dist:desktop");
      expect(commands("release", job)).not.toContain("npm run check:bundle");
      expect(producer.steps.findIndex((step) => step.id === "package-upload")).toBeGreaterThan(
        producer.steps.findIndex((step) => step.run === "npm run smoke:desktop"),
      );
      expect(upload.uses).toMatch(/^actions\/upload-artifact@[a-f0-9]{40}$/u);
      expect(upload.with).toMatchObject({ "retention-days": 7, "compression-level": 0, "if-no-files-found": "error" });
      expect(upload.with?.path).toContain("release-desktop${{ inputs.edition == 'demo' && '-demo' || '' }}/");
      expect(upload.with?.path).toContain("release-notes/${{ github.ref_name }}.md");
      expect(upload.if).toBeUndefined();
    }
  });

  it("publishes each producer artifact by ID without rebuilding on a delivery retry", () => {
    const release = readWorkflow("release");
    const delivery = release.jobs.release;
    expect(delivery.concurrency).toEqual({ group: "steam-publishing", queue: "max", "cancel-in-progress": false });
    expect(delivery.needs).toEqual(["package", "package-demo"]);
    for (const job of ["package", "package-demo"]) {
      const caller = release.jobs[job];
      expect(caller.uses).toBe("./.github/workflows/release-package.yml");
      expect(readWorkflow("release-package").on.workflow_call?.outputs).toMatchObject({
        "artifact-id": { value: "${{ jobs.package.outputs.artifact-id }}" },
      });
      expect(workflowJob("release", job).outputs?.["artifact-id"]).toBe(
        "${{ steps.package-upload.outputs.artifact-id }}",
      );
      const download = delivery.steps.find(
        (step) => step.with?.["artifact-ids"] === `\${{ needs.${job}.outputs.artifact-id }}`,
      )!;
      expect(download.with?.["merge-multiple"]).toBe(true);
      expect(delivery.steps.indexOf(download)).toBeLessThan(
        delivery.steps.findIndex((step) => step.name === "Steam upload"),
      );
    }
    expect(stringify(delivery)).not.toContain("github.run_attempt");
    expect(commands("release", "release")).not.toContain("npm run dist:desktop");
  });

  it.each([
    ["ci", "e2e"],
    ["release", "e2e-full"],
    ["nightly", "e2e-web"],
  ])("keeps music in %s browser artifacts", (name, job) => {
    const steps = workflowJob(name, job).steps;
    expect(stringify(steps)).not.toContain("!dist/Music/");
    expect(steps).toContainEqual(
      expect.objectContaining({ name: "Smoke test downloaded build including music", run: "npm run smoke:preview" }),
    );
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
      const condition = packaging.if!;
      expect(condition).toContain("!cancelled()");
      expect(
        runInNewContext(condition.replaceAll("needs.ship-gate", "needs.renderer"), {
          cancelled: () => cancelled,
          github: { event_name: "push" },
          needs: {
            changes: { result: changes, outputs: { desktop: String(selected) } },
            renderer: { result: renderer },
          },
        }),
      ).toBe(expected);
    },
  );

  it("preserves music in the shared packaging artifact and gates publishing on package startup", () => {
    const renderer = workflowJob("ci", "ship-gate");
    expect(stringify(renderer)).not.toContain("!dist/Music/");
    expect(commands("ci", "ship-gate")).toContain("npm run check:bundle");
    const steps = commands("ci", "desktop-build");
    expect(steps.indexOf("npm run smoke:desktop")).toBeGreaterThan(steps.indexOf("node scripts/dist-desktop.mjs"));
  });
});

describe("build failure visibility", () => {
  it("retains nightly performance diagnostics with a valid fixed retention period", () => {
    const upload = workflowJob("nightly", "performance-discovery").steps.find(
      (step) => step.name === "Upload replay and diagnostics",
    )!;
    expect(upload.if).toBe("always()");
    expect(upload.with?.["retention-days"]).toBe(7);
    expect(upload.with?.path).toContain("reports/performance/");
    expect(upload.with?.path).toContain("reports/compact/");
  });

  it.each([
    ["ci", "build"],
    ["ci", "ship-gate"],
    ["ci", "desktop-build"],
    ["release", "build"],
    ["release", "package"],
    ["release", "package-demo"],
    ["nightly", "prepare"],
    ["nightly", "ship-gate-full"],
  ])("retains full logs for %s/%s failures", (workflow, job) => {
    const upload = workflowJob(workflow, job).steps.find((step) => step.name === "Retain build failure diagnostics")!;
    expect(upload.if).toContain("failure()");
    const expectedName =
      workflow === "release" && job.startsWith("package")
        ? "build-diagnostics-release-package${{ inputs.edition == 'demo' && '-demo' || '' }}"
        : readWorkflow(workflow).jobs[job].with?.diagnostics
          ? "${{ inputs.diagnostics }}"
          : `build-diagnostics-${workflow}-${job}`;
    if (readWorkflow(workflow).jobs[job].with?.diagnostics)
      expect(readWorkflow(workflow).jobs[job].with?.diagnostics).toBe(`build-diagnostics-${workflow}-${job}`);
    expect(upload.with).toMatchObject({
      name: expectedName,
      "retention-days": 1,
      "if-no-files-found": "ignore",
    });
    for (const entry of ["reports/compact/", "reports/current-run.*", "reports/runs/"])
      expect(upload.with?.path).toContain(entry);
  });

  it("rejects a mismatched tag before building the release web artifact", () => {
    const build = workflowJob("release", "build");
    expect(readWorkflow("release").jobs.build.with?.release).toBe(true);
    const validation = build.steps.findIndex((step) => step.run === "node scripts/verify-release.mjs --skip-package");
    expect(validation).toBeGreaterThan(build.steps.findIndex((step) => step.uses === "./.github/actions/setup"));
    expect(validation).toBeLessThan(build.steps.findIndex((step) => step.run === "npm run build"));
    expect(build.steps[validation]).toMatchObject({
      if: "${{ inputs.release }}",
      env: { RELEASE_TAG: "${{ github.ref_name }}" },
    });
    expect(readWorkflow("release").jobs["e2e-full"].needs).toBe("build");
    expect(workflowJob("release", "package").steps).toContainEqual(
      expect.objectContaining({ run: "node scripts/verify-release.mjs --skip-package" }),
    );
  });
});
