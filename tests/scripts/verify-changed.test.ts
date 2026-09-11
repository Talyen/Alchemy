import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  commandExposure,
  firstOutputLine,
  outputStats,
  sanitizeOutput,
  tailOutput,
  writeFailureDigest,
} from "../../scripts/lib/compact-output.mjs";
import { resolveRoutePlan, resolveRoutes, ROUTES, validateRouteCatalog } from "../../scripts/lib/change-routes.mjs";
import { TEST_SUITES, validateTestSuitePaths } from "../../scripts/lib/test-commands.mjs";
import { formatPlan, filterPlanCommands, parseVerifyArgs } from "../../scripts/verify-changed.mjs";

describe("verification selection", () => {
  it("uses a small broad category catalog", () => {
    expect(ROUTES.length).toBeLessThanOrEqual(10);
    expect(ROUTES.reduce((count, route) => count + route.patterns.length, 0)).toBeLessThanOrEqual(70);
    expect(validateRouteCatalog()).toEqual([]);
    expect(validateTestSuitePaths(process.cwd(), TEST_SUITES.shipUnit)).toEqual([]);
  });

  it("selects dependency-related tests for ordinary runtime changes", () => {
    const plan = resolveRoutePlan(["src/lib/battle/damage-calc.ts"]);
    expect(plan.routes.map((route) => route.id)).toEqual(["runtime"]);
    expect(plan.commands.map((command) => command.key)).toEqual(["related"]);
    expect(plan.commands[0]?.args).toEqual([
      "vitest",
      "related",
      "src/lib/battle/damage-calc.ts",
      "--run",
      "--passWithNoTests",
    ]);
  });

  it("executes changed tests directly", () => {
    const filePath = "tests/lib/battle/damage-calc.test.ts";
    const plan = resolveRoutePlan([filePath]);
    expect(plan.routes.map((route) => route.id)).toEqual(["unit-test"]);
    expect(plan.commands[0]).toMatchObject({ key: "unit-changed", args: ["vitest", "run", filePath] });
  });

  it("omits retired test files without losing surviving tests or risk escalations", () => {
    const retired = "tests/lib/battle/retired-coverage.test.ts";
    const surviving = "tests/lib/battle/damage-calc.test.ts";
    expect(fs.existsSync(retired)).toBe(false);
    const plan = resolveRoutePlan([retired, surviving]);
    expect(plan.paths).toEqual([retired, surviving]);
    expect(plan.commands).toEqual([
      expect.objectContaining({ key: "unit-changed", args: ["vitest", "run", surviving] }),
    ]);
    expect(resolveRoutePlan([retired]).commands).toEqual([]);
    expect(resolveRoutePlan(["tests/desktop/retired-coverage.test.ts"]).commands.map((command) => command.key)).toEqual(
      ["unit-desktop"],
    );
  });

  it("runs repository-reading tooling tests exactly once", () => {
    expect(resolveRoutePlan(["scripts/check.mjs"]).commands.map((command) => command.key)).toEqual(["unit-tooling"]);
    expect(resolveRoutePlan(["tests/scripts/check.test.ts"]).commands.map((command) => command.key)).toEqual([
      "unit-tooling",
    ]);
    expect(
      resolveRoutePlan(["tests/architecture/rng-canonical-doors.test.ts"]).commands.map((command) => command.key),
    ).toEqual(["unit-tooling"]);
  });

  it("preserves gameplay test selection alongside tooling changes", () => {
    const runtimePath = "src/lib/battle/damage-calc.ts";
    const plan = resolveRoutePlan(["scripts/check.mjs", runtimePath, "src/lib/game-data/effects/BATTLE_HANDLERS.md"]);
    expect(plan.commands.map((command) => command.key)).toEqual(["docs-check", "unit-tooling", "related"]);
    expect(plan.commands.find((command) => command.key === "related")?.args).toEqual([
      "vitest",
      "related",
      runtimePath,
      "--run",
      "--passWithNoTests",
    ]);
  });

  it("adds only the retained risk escalations", () => {
    expect(
      resolveRoutePlan(["src/features/alchemy/shared/storage/io.ts"]).commands.map((command) => command.key),
    ).toEqual(["related", "unit-save"]);
    expect(resolveRoutePlan(["scripts/assets/core-assets.mjs"]).commands.map((command) => command.key)).toEqual([
      "assets-check",
      "unit-tooling",
    ]);
    expect(resolveRoutePlan(["desktop/main.cjs"]).commands.map((command) => command.key)).toEqual([
      "related",
      "unit-desktop",
    ]);
    expect(resolveRoutePlan(["src/lib/balance/report-run.ts"]).commands.map((command) => command.key)).toEqual([
      "related",
      "report-balance",
    ]);
  });

  it("keeps documentation free of unit, build, and browser work", () => {
    const plan = resolveRoutePlan([
      "docs/new-guide.md",
      "scripts/README.md",
      "src/features/alchemy/shared/storage/MIGRATIONS.md",
      "tests/e2e/README.md",
    ]);
    expect(resolveRoutes(plan.paths).map((route) => route.id)).toEqual(["documentation"]);
    expect(plan.commands.map((command) => command.key)).toEqual(["docs-check"]);
    expect(formatPlan(plan)).toContain("documentation checks");
  });

  it("treats browser specs as explicit local debugging flows", () => {
    expect(resolveRoutePlan(["tests/e2e/specs/shop-and-rewards.spec.ts"]).commands).toEqual([]);
  });

  it("retains desktop and browser selection after folder moves", () => {
    expect(resolveRoutePlan(["tests/desktop/desktop-security.test.ts"]).commands.map((command) => command.key)).toEqual(
      ["unit-desktop", "unit-changed"],
    );
    for (const file of ["tests/electron/electron-helpers.ts", "tests/electron/electron-global-setup.ts"]) {
      expect(resolveRoutes([file]).map((route) => route.id)).toEqual(["browser-test"]);
    }
  });

  it("keeps uncategorized executable selection honest", () => {
    const plan = resolveRoutePlan(["custom/tool.mjs"]);
    expect(plan.routes.map((route) => route.id)).toEqual(["unknown"]);
    expect(plan.commands.map((command) => command.key)).toEqual(["related"]);
    expect(formatPlan(plan)).toContain("uncategorized paths");
  });

  it("skips documentation checks on request without losing other escalations", () => {
    const plan = resolveRoutePlan(["scripts/check.mjs", "src/lib/battle/damage-calc.ts", "docs/guide.md"]);
    expect(plan.commands.map((command) => command.key)).toContain("docs-check");
    const filtered = filterPlanCommands(plan, new Set(["skip-docs-check"]));
    expect(filtered.commands.map((command) => command.key)).not.toContain("docs-check");
    expect(filtered.commands.map((command) => command.key)).toEqual(
      plan.commands.map((command) => command.key).filter((key) => key !== "docs-check"),
    );
    expect(filterPlanCommands(plan, new Set()).commands).toBe(plan.commands);
  });

  it("rejects unknown verify flags before running commands", () => {
    expect(parseVerifyArgs(["src/App.tsx", "--plan"]).flags).toEqual(new Set(["plan"]));
    expect(() => parseVerifyArgs(["src/App.tsx", "--pla"])).toThrow("Unknown verify option: --pla");
  });
});

describe("verification diagnostics", () => {
  it("measures raw and exposed output", () => {
    expect(outputStats("first\nsecond")).toEqual({ bytes: 12, lines: 2 });
    expect(
      commandExposure({
        key: "fixture",
        label: "fixture",
        command: "npm test",
        result: { output: "0123456789", status: 1, elapsedMs: 15.4 },
        exposedOutput: "6789",
      }),
    ).toMatchObject({ rawBytes: 10, exposedBytes: 4, omittedBytes: 6, omittedPercent: 60 });
  });

  it("writes a bounded digest and separate full log", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "verify-digest-"));
    try {
      const result = { status: 1, elapsedMs: 10, output: "x".repeat(5_000) };
      const files = writeFailureDigest(
        root,
        { key: "test", label: "test", command: "npm", args: ["test"], reason: "fixture" },
        result,
        "run-id",
        0,
      );
      expect(fs.readFileSync(files.digestPath, "utf8").length).toBeLessThan(result.output.length);
      expect(fs.readFileSync(files.logPath, "utf8")).toContain("x".repeat(100));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps compact output useful", () => {
    expect(firstOutputLine("\nTimeoutError: locator.click\nstack")).toBe("TimeoutError: locator.click");
    expect(tailOutput("x".repeat(30), 10)).toContain("bytes omitted");
    expect(sanitizeOutput("\u001b[31mError\u001b[0m\u0000\nnext")).toBe("Error\nnext");
  });
});
