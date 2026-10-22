import { randomUUID } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runCheck } from "../../scripts/check.mjs";
import { filterPlanCommands } from "../../scripts/verify-changed.mjs";
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

it("checks types by default without builds, installs, browsers or full lint", async () => {
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
    "source and test types",
    "selected-file format",
    "selected-file lint",
  ]);
  expect(JSON.parse(readFileSync("reports/current-run.json", "utf8")).summary).toBe(
    "Local verification complete; CI and platform acceptance are separate.",
  );
});

it("selects consequential tooling and save protection by default while reserving broader gates", () => {
  const plan = resolveRoutePlan(["scripts/check.mjs", "src/features/alchemy/shared/storage/io.ts"]);
  expect(filterPlanCommands(plan, new Set()).commands.map((command) => command.key)).toEqual([
    "unit-interactions",
    "related",
    "unit-save",
    "unit-tooling",
  ]);
  expect(filterPlanCommands(plan, new Set(["full"])).commands).toBe(plan.commands);
  expect(
    filterPlanCommands(resolveRoutePlan(["Docs/REFERENCE.md"]), new Set()).commands.map((command) => command.key),
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

it("checks documentation automatically without unrelated units, localization or static work", async () => {
  const calls: string[] = [];
  expect(
    await runCheck(["Docs/REFERENCE.md"], {
      runner: (label) => {
        calls.push(label);
        return 0;
      },
      captureDigest: () => ({ head: "test", hash: "unchanged" }),
    }),
  ).toBe(0);
  expect(calls).toEqual(["changed-path verification", "selected-file format"]);
  expect(
    filterPlanCommands(resolveRoutePlan(["Docs/REFERENCE.md"]), new Set()).commands.map((command) => command.key),
  ).toEqual(["docs-check"]);
});

it("previews the same selection without executing or capturing source state", async () => {
  const runner = vi.fn(() => 0);
  const captureDigest = vi.fn(() => ({ head: "test", hash: "unchanged" }));
  expect(await runCheck(["scripts/check.mjs", "Docs/REFERENCE.md", "--plan"], { runner, captureDigest })).toBe(0);
  expect(runner).not.toHaveBeenCalled();
  expect(captureDigest).not.toHaveBeenCalled();
});

it("checks localization inputs but skips tooling-only and test-only edits", async () => {
  for (const [file, localized] of [
    ["scripts/check.mjs", false],
    ["tests/scripts/check.test.ts", false],
    ["src/lib/game-data/cards/index.ts", true],
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
