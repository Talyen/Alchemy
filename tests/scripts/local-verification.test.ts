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

it("keeps runtime and package handoff free of builds, installs, browsers, and broad static checks", async () => {
  const calls: string[] = [];
  expect(
    await runCheck(["src/App.tsx", "package.json"], {
      runner: (label, _command, args, env) => {
        calls.push(label);
        expect(env.NODE_OPTIONS).toContain("--max-old-space-size=512");
        expect(env.RAYON_NUM_THREADS).toBe("1");
        expect(args).not.toContain("--full");
        return 0;
      },
      captureDigest: () => ({ head: "test", hash: "unchanged" }),
    }),
  ).toBe(0);
  expect(calls).toEqual(["fixed Node smoke selection", "selected-file format"]);
  expect(JSON.parse(readFileSync("reports/current-run.json", "utf8")).summary).toBe(
    "Local check passed; full CI validation is required.",
  );
});

it("uses bounded smoke even for tooling and save changes, with full coverage only by explicit selection", () => {
  const plan = resolveRoutePlan(["scripts/check.mjs", "src/features/alchemy/shared/storage/io.ts"]);
  expect(filterPlanCommands(plan, new Set()).commands.map((command) => command.key)).toEqual(["unit-local"]);
  expect(filterPlanCommands(plan, new Set(["full"])).commands).toBe(plan.commands);
  expect(filterPlanCommands(resolveRoutePlan(["Docs/REFERENCE.md"]), new Set()).commands).toEqual([]);
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
