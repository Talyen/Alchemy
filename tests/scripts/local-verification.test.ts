import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runCheck } from "../../scripts/check.mjs";
import { filterPlanCommands } from "../../scripts/verify-changed.mjs";
import { resolveCheckPlan } from "../../scripts/lib/verification/check-plan.mjs";
import { resolveRoutePlan } from "../../scripts/lib/verification/change-routes.mjs";
import { normalizeRunId } from "../../scripts/lib/verification/current-run.mjs";

let runId: string;
beforeEach(() => {
  runId = normalizeRunId(`local-check-test-${randomUUID()}`);
  vi.stubEnv("ALCHEMY_RUN_ID", runId);
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(`reports/runs/${runId}`, { recursive: true, force: true });
});

it("defers tests and compilation to CI while keeping lightweight task checks", async () => {
  const calls: string[] = [];
  expect(
    await runCheck(["src/App.tsx", "package.json"], {
      runner: (label, _command, args, env) => {
        calls.push(label);
        expect(args).not.toContain("lint:ci");
        expect(env.RAYON_NUM_THREADS).toBe("1");
        expect(args).not.toContain("--full");
        return 0;
      },
      captureDigest: () => ({ head: "test", hash: "unchanged" }),
    }),
  ).toBe(0);
  expect(calls).toEqual([
    "localization freshness and contracts",
    "changed-path verification",
    "selected-file format",
    "selected-file lint",
  ]);
  const receipt = JSON.parse(readFileSync(`reports/runs/${runId}/check/coverage.json`, "utf8"));
  expect(receipt.selectedPaths).toEqual(expect.arrayContaining(["src/App.tsx", "package.json"]));
  expect(receipt.steps).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        label: "source and test types",
        status: "skipped",
        reason: "CI-only in the default local gate",
      }),
      expect.objectContaining({ label: "selected-file lint", status: "passed" }),
    ]),
  );
  expect(receipt.limitations[0]).toContain("deferred to CI");
  expect(JSON.parse(readFileSync("reports/current-run.json", "utf8")).summary).toBe(
    "Local verification complete; CI and platform acceptance are separate.",
  );
});

it("defers automatic tooling and save suites while retaining full verification selection", () => {
  const plan = resolveRoutePlan(["scripts/check.mjs", "src/features/alchemy/shared/storage/io.ts"]);
  expect(filterPlanCommands(plan, new Set()).commands).toEqual([]);
  expect(filterPlanCommands(plan, new Set(["full"])).commands).toBe(plan.commands);
  expect(
    filterPlanCommands(resolveRoutePlan(["Docs/SIMULATION.md"]), new Set()).commands.map((command) => command.key),
  ).toEqual(["docs-check"]);
});

it("selects changed and related unit coverage without admitting non-unit gates", () => {
  const plan = resolveRoutePlan([
    "src/features/alchemy/shared/storage/io.ts",
    "scripts/check.mjs",
    "scripts/assets.mjs",
  ]);
  const commands = filterPlanCommands(plan, new Set(["unit"])).commands;
  expect(commands.map((command) => command.key)).toEqual(expect.arrayContaining(["unit-save", "unit-tooling"]));
  expect(commands.every((command) => command.key === "related" || command.key.startsWith("unit-"))).toBe(true);
  expect(commands.some((command) => command.key === "unit-local")).toBe(false);
});

it("replaces overlapping selected unit runs with one complete suite for repository-wide checks", () => {
  const plan = resolveRoutePlan([
    "scripts/check.mjs",
    "scripts/assets.mjs",
    "src/features/alchemy/shared/storage/io.ts",
  ]);
  const commands = filterPlanCommands(plan, new Set(["full", "all-units"])).commands;
  expect(
    commands
      .filter((command) => command.key === "related" || command.key.startsWith("unit-"))
      .map((command) => command.key),
  ).toEqual(["unit-all"]);
  expect(commands.some((command) => command.key === "assets-check")).toBe(true);
});

it("checks documentation automatically without unrelated units, localization or static work", async () => {
  const calls: string[] = [];
  expect(
    await runCheck(["Docs/SIMULATION.md"], {
      runner: (label) => {
        calls.push(label);
        return 0;
      },
      captureDigest: () => ({ head: "test", hash: "unchanged" }),
    }),
  ).toBe(0);
  expect(calls).toEqual(["changed-path verification", "selected-file format"]);
  expect(
    filterPlanCommands(resolveRoutePlan(["Docs/SIMULATION.md"]), new Set()).commands.map((command) => command.key),
  ).toEqual(["docs-check"]);
});

it("previews the same selection without executing or capturing source state", async () => {
  const runner = vi.fn(() => 0);
  const captureDigest = vi.fn(() => ({ head: "test", hash: "unchanged" }));
  expect(await runCheck(["scripts/check.mjs", "Docs/SIMULATION.md", "--plan"], { runner, captureDigest })).toBe(0);
  expect(runner).not.toHaveBeenCalled();
  expect(captureDigest).not.toHaveBeenCalled();
});

it("rejects the full local gate before source capture while allowing its plan", async () => {
  vi.stubEnv("GITHUB_ACTIONS", undefined);
  vi.stubEnv("ALCHEMY_ALLOW_HEAVY_LOCAL", undefined);
  const captureDigest = vi.fn(() => ({ head: "test", hash: "unchanged" }));
  await expect(runCheck(["scripts/check.mjs", "--full"], { captureDigest })).rejects.toThrow("belongs to CI");
  expect(captureDigest).not.toHaveBeenCalled();
  expect(await runCheck(["scripts/check.mjs", "--full", "--plan"], { captureDigest })).toBe(0);
  expect(captureDigest).not.toHaveBeenCalled();
});

it("checks localization inputs but skips tooling-only and test-only edits", async () => {
  for (const [file, localized] of [
    ["scripts/check.mjs", false],
    ["tests/scripts/check.test.ts", false],
    ["src/lib/game-data/cards/library/archery.ts", true],
    ["src/lib/localization/locales/fr.json", true],
    ["steam/store-copy.source.json", true],
  ] as const) {
    const calls: string[] = [];
    expect(
      await runCheck([file], {
        runner: (label) => {
          calls.push(label);
          return 0;
        },
        captureDigest: () => ({ head: "test", hash: "unchanged" }),
      }),
    ).toBe(0);
    expect(calls.includes("localization freshness and contracts")).toBe(localized);
  }
});

it("reports large formatting and lint selections as deferred", () => {
  const root = mkdtempSync(join(tmpdir(), "alchemy-check-plan-"));
  try {
    const files = Array.from({ length: 51 }, (_, index) => `file-${index}.ts`);
    for (const file of files) writeFileSync(join(root, file), "export {};\n");
    const plan = resolveCheckPlan(files, { rootDir: root });
    for (const key of ["local-format", "local-lint"]) {
      expect(plan.steps.find((step) => step.key === key)).toMatchObject({
        enabled: false,
        reason: expect.stringContaining("deferred to CI"),
      });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
