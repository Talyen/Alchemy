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
} from "../../scripts/lib/compact-output.mjs";
import { resolveRoutePlan, resolveRoutes, ROUTES, validateRouteCatalog } from "../../scripts/lib/change-routes.mjs";
import { TEST_SUITES, validateTestSuitePaths } from "../../scripts/lib/test-commands.mjs";
import { measureAllRoutes, ROUTE_CONTEXT_BUDGETS } from "../../scripts/measure-agent-context.mjs";
import { formatPlan, writeFailureDigest } from "../../scripts/verify-changed.mjs";

describe("verification selection", () => {
  it("uses a small broad category catalog", () => {
    expect(ROUTES.length).toBeLessThanOrEqual(10);
    expect(ROUTES.reduce((count, route) => count + route.patterns.length, 0)).toBeLessThanOrEqual(65);
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

  it("adds only the retained risk escalations", () => {
    expect(
      resolveRoutePlan(["src/features/alchemy/shared/storage/io.ts"]).commands.map((command) => command.key),
    ).toEqual(["related", "unit-save"]);
    expect(resolveRoutePlan(["scripts/assets/core-assets.mjs"]).commands.map((command) => command.key)).toEqual([
      "related",
      "assets-check",
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
    const plan = resolveRoutePlan(["docs/new-guide.md"]);
    expect(resolveRoutes(plan.paths).map((route) => route.id)).toEqual(["documentation"]);
    expect(plan.commands.map((command) => command.key)).toEqual(["docs-check"]);
    expect(formatPlan(plan)).toContain("documentation checks");
  });

  it("treats browser specs as explicit local debugging flows", () => {
    expect(resolveRoutePlan(["tests/shop-and-rewards.spec.ts"]).commands).toEqual([]);
  });

  it("keeps uncategorized executable selection honest", () => {
    const plan = resolveRoutePlan(["custom/tool.mjs"]);
    expect(plan.routes.map((route) => route.id)).toEqual(["unknown"]);
    expect(plan.commands.map((command) => command.key)).toEqual(["related"]);
    expect(formatPlan(plan)).toContain("uncategorized paths");
  });

  it("keeps route context measurements within advisory budgets", () => {
    const measurements = measureAllRoutes();
    expect(new Set(measurements.map((measurement) => measurement.routes.join("+")))).toEqual(
      new Set(Object.keys(ROUTE_CONTEXT_BUDGETS)),
    );
    for (const measurement of measurements) {
      const budget = ROUTE_CONTEXT_BUDGETS[measurement.routes[0] ?? "unknown"];
      expect(measurement.selectedBytes).toBeLessThanOrEqual(budget?.preread ?? 0);
      expect(measurement.totalContextBytes).toBeLessThanOrEqual(budget?.total ?? 0);
    }
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
