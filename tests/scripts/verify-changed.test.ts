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
import { validateRouteCatalog } from "../../scripts/lib/change-routes.mjs";
import { TEST_SUITES, validateTestSuitePaths } from "../../scripts/lib/test-suites.mjs";
import { measureAllRoutes, measureContext, ROUTE_CONTEXT_BUDGETS } from "../../scripts/measure-agent-context.mjs";
import { formatPlan, writeFailureDigest } from "../../scripts/verify-changed.mjs";
import { resolveRoutePlan as resolvePlan, resolveRoutes } from "../../scripts/lib/change-routes.mjs";

describe("verify-changed route catalog", () => {
  it("measures raw and agent-exposed command output", () => {
    expect(outputStats("first\nsecond")).toEqual({ bytes: 12, lines: 2 });
    expect(
      commandExposure({
        key: "fixture",
        label: "fixture command",
        command: "npm test",
        result: { output: "0123456789", status: 1, elapsedMs: 15.4 },
        exposedOutput: "6789",
      }),
    ).toMatchObject({
      key: "fixture",
      status: 1,
      durationMs: 15,
      rawBytes: 10,
      exposedBytes: 4,
      omittedBytes: 6,
      omittedPercent: 60,
      budgetBytes: 4_096,
      overBudget: false,
    });
    expect(
      commandExposure({
        key: "flood",
        label: "flood",
        command: "fixture",
        result: { output: "x".repeat(5_000), status: 0, elapsedMs: 1 },
        exposedOutput: "x".repeat(5_000),
      }).overBudget,
    ).toBe(true);
    expect(
      commandExposure({
        key: "verbose",
        label: "verbose",
        command: "fixture",
        result: { output: "x".repeat(5_000), status: 0, elapsedMs: 1 },
        exposedOutput: "x".repeat(5_000),
        budgetBytes: null,
      }),
    ).toMatchObject({ budgetBytes: null, overBudget: false });
  });
  it("writes a run-attributed bounded digest while keeping the full stream separate", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "verify-digest-"));
    try {
      const output = `> alchemy@0.1.0 test\n> vitest run\n\nAssertionError: expected map node to exist\n${"x".repeat(5_000)}`;
      const result = writeFailureDigest(
        root,
        { key: "unit-map", label: "map unit tests", command: "npm", args: [], reason: "fixture" },
        { output, status: 1, elapsedMs: 1234 },
        "verify-run-id",
        0,
      );
      const digest = fs.readFileSync(result.digestPath, "utf8");
      const full = fs.readFileSync(result.logPath, "utf8");
      expect(digest).toContain("Run: `verify-run-id`");
      expect(digest).toContain("Verification failure: map unit tests");
      expect(digest).toContain("AssertionError: expected map node to exist");
      expect(digest.length).toBeLessThan(full.length);
      expect(full).toBe(output);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps concrete command paths, fixtures, and owner headings current", () => {
    expect(validateRouteCatalog({ rootDir: process.cwd() })).toEqual([]);
  });

  it("keeps ship suites non-empty after path changes", () => {
    expect(validateTestSuitePaths(process.cwd(), TEST_SUITES.shipUnit)).toEqual([]);
  });

  it("covers the smallest complete active-run route and deduplicates commands", () => {
    const plan = resolvePlan([
      "src/features/alchemy/shared/stores/run-session-command.ts",
      "src/app/use-app-navigation.ts",
    ]);

    expect(plan.routes.map((route) => route.id)).toEqual(expect.arrayContaining(["active-run", "routing"]));
    expect(plan.commands.map((command) => command.key)).toEqual([
      "unit-active",
      "boundary",
      "e2e-prepush",
      "unit-routing",
    ]);
    expect(plan.commands.flatMap((command) => command.args).every((arg) => !arg.includes("*"))).toBe(true);
  });

  it("adds screen-specific E2E only for an explicit escalation", () => {
    const defaultPlan = resolvePlan(["src/lib/battle/damage.ts"], { e2e: true });
    const e2ePlan = resolvePlan(["src/features/alchemy/run-loop/screens/alchemist-shop-screen.tsx"], { e2e: true });
    const explicitPlan = resolvePlan(["src/lib/battle/damage.ts"], { e2e: "mystery" });

    expect(defaultPlan.commands.map((command) => command.key)).not.toContain("e2e-shop");
    expect(e2ePlan.commands.map((command) => command.key)).toContain("e2e-shop");
    expect(e2ePlan.commands.map((command) => command.key)).not.toContain("e2e-mystery");
    expect(explicitPlan.commands.map((command) => command.key)).toContain("e2e-mystery");
  });

  it("keeps focused E2E flows out of local default plans", () => {
    expect(resolvePlan(["src/features/alchemy/shared/storage/io.ts"]).commands.map((command) => command.key)).toEqual([
      "unit-save",
      "e2e-prepush",
    ]);
    expect(
      resolvePlan(["src/features/alchemy/meta/screens/armory-screen.tsx"]).commands.map((command) => command.key),
    ).toEqual(["unit-gear"]);

    const audioMysteryKeys = resolvePlan(["src/lib/audio-sfx.ts", "src/lib/mystery/pool.ts"]).commands.map(
      (command) => command.key,
    );
    expect(audioMysteryKeys).toContain("unit-audio");
    expect(audioMysteryKeys).toContain("unit-mystery");
    expect(audioMysteryKeys).not.toContain("e2e-audio");
    expect(audioMysteryKeys).not.toContain("e2e-mystery");

    expect(
      resolvePlan(["src/features/alchemy/run-loop/screens/alchemist-shop-screen.tsx"]).commands.map(
        (command) => command.key,
      ),
    ).toEqual(["unit-shop", "typecheck"]);
  });

  it("escalates focused E2E flows on explicit selection", () => {
    for (const [selection, commandKey] of [
      ["save", "e2e-save"],
      ["shop", "e2e-shop"],
      ["audio", "e2e-audio"],
      ["gear", "e2e-gear"],
      ["mystery", "e2e-mystery"],
    ] as const) {
      const keys = resolvePlan(["src/lib/battle/damage.ts"], { e2e: selection }).commands.map((command) => command.key);
      expect(keys, selection).toContain(commandKey);
    }

    const allKeys = resolvePlan(
      ["src/features/alchemy/shared/storage/io.ts", "src/features/alchemy/meta/screens/armory-screen.tsx"],
      { e2e: true },
    ).commands.map((command) => command.key);
    expect(allKeys).toContain("e2e-save");
    expect(allKeys).toContain("e2e-gear");
  });

  it("keeps the default plan bounded and exposes full argv only on request", () => {
    const plan = resolvePlan(["src/lib/battle/damage.ts"]);
    const compact = formatPlan(plan);
    const verbose = formatPlan(plan, { verbosePlan: true });

    expect(compact).toContain("unit-battle: battle/card unit tests");
    expect(compact).not.toContain("tests/lib/battle");
    expect(verbose).toContain("npm test -- tests/lib/battle");
  });

  it("does not route gear stores through the active-run matrix", () => {
    expect(resolveRoutes(["src/features/alchemy/shared/stores/gear-store.ts"]).map((route) => route.id)).toEqual([
      "gear",
    ]);
    expect(
      resolveRoutes(["src/features/alchemy/shared/stores/gear-store.ts", "src/lib/gear/affixes.ts"]).map(
        (route) => route.id,
      ),
    ).toContain("gear");
  });

  it("routes documentation changes to the documentation contract", () => {
    expect(resolveRoutes(["docs/new-guide.md"]).map((route) => route.id)).toEqual(["documentation"]);
    expect(resolvePlan(["docs/new-guide.md"]).commands.map((command) => command.key)).toEqual(["docs-check"]);
  });

  it("routes CI workflow changes to the CI path-filter contract", () => {
    expect(resolveRoutes([".github/workflows/ci.yml"]).map((route) => route.id)).toEqual(["ci-routing"]);
    expect(resolvePlan([".github/workflows/ci.yml"]).commands.map((command) => command.key)).toEqual(["ci-routing"]);
  });

  it("routes canonical Armory and repository-tooling paths to real owners", () => {
    expect(resolveRoutes(["src/features/alchemy/meta/screens/armory-screen.tsx"]).map((route) => route.id)).toEqual([
      "gear",
    ]);
    expect(resolveRoutes(["tests/fixtures/e2e.ts"]).map((route) => route.id)).toEqual(["e2e-helper"]);
    expect(resolveRoutes(["playwright.config.ts"]).map((route) => route.id)).toEqual(["e2e-helper"]);
    expect(resolveRoutes(["scripts/measure-agent-context.mjs"]).map((route) => route.id)).toEqual(["tooling"]);
    expect(resolveRoutes(["package.json"]).map((route) => route.id)).toEqual(["tooling"]);
    expect(resolveRoutes(["src/lib/game-data/assets.generated.ts"]).map((route) => route.id)).toEqual(["generated"]);
  });

  it("labels an unowned path honestly while retaining the static fallback", () => {
    expect(resolveRoutes(["unknown.file"]).map((route) => route.id)).toEqual(["unknown"]);
    const plan = resolvePlan(["unknown.file"]);
    expect(plan.commands.map((command) => command.key)).toEqual(["typecheck"]);
    expect(formatPlan(plan)).toContain("route ownership is unknown");
  });

  it("retains the unknown fallback when a mixed diff also has an owned path", () => {
    const plan = resolvePlan(["docs/REFERENCE.md", "src/new-subsystem/example.ts"]);
    expect(plan.routes.map((route) => route.id)).toEqual(["documentation", "unknown"]);
    expect(plan.commands.map((command) => command.key)).toEqual(["docs-check", "typecheck"]);
    expect(formatPlan(plan)).toContain("route ownership is unknown");
  });

  it("executes changed Vitest files directly", () => {
    const filePath = "tests/lib/balance/findings.test.ts";
    const plan = resolvePlan([filePath]);
    expect(plan.routes.map((route) => route.id)).toEqual(["unit-test"]);
    expect(plan.commands.map((command) => command.key)).toEqual(["unit-changed"]);
    expect(plan.commands[0]?.args).toEqual(["test", "--", filePath]);
  });

  it("routes repository-tooling tests and declarations through their owning suite", () => {
    for (const filePath of [
      "tests/scripts/verify-changed.test.ts",
      "tests/scripts/global.d.ts",
      "tests/architecture/affix-catalog-guard.test.ts",
    ]) {
      const plan = resolvePlan([filePath]);
      expect(
        plan.routes.map((route) => route.id),
        filePath,
      ).toEqual(["tooling"]);
      expect(
        plan.commands.map((command) => command.key),
        filePath,
      ).toEqual(["unit-tooling", "typecheck"]);
    }
  });

  it("measures only the owner docs for a representative route by default", () => {
    const measurement = measureContext({ paths: ["src/lib/battle/damage.ts"] });
    expect(measurement.docs.map((doc) => doc.path)).toEqual(["AGENTS.md", "docs/REFERENCE.md"]);
    expect(measurement.docs[1]?.heading).toBe("Battle Implementation Rules");
    expect(measurement.selectedBytes).toBe(measurement.instructionBytes + measurement.ownerDocBytes);
    expect(measurement.changedFileBytes).toBeGreaterThan(0);
    expect(measurement.selectedBytes).toBeLessThan(20_000);
    expect(measurement.verificationCommands).toBe(1);
  });

  it("measures every catalog heading and preserves distinct sections", () => {
    expect(() => measureAllRoutes()).not.toThrow();
    const measurement = measureContext({
      paths: ["src/features/alchemy/shared/storage/io.ts", "src/features/alchemy/meta/screens/armory-screen.tsx"],
    });
    expect(measurement.ownerDocs.map((doc) => `${doc.path}#${doc.heading ?? ""}`)).toEqual(
      expect.arrayContaining([
        "docs/WORKFLOWS.md#Change persisted save data",
        "src/features/alchemy/shared/storage/MIGRATIONS.md#Public save contract",
        "docs/WORKFLOWS.md#Add permanent Gear",
        "docs/ARMORY.md#Layout",
      ]),
    );
  });

  it("keeps representative prereads within their ratchets", () => {
    const fixtures = [
      // damage.ts context (file + owner docs) measures ~11.3KB.
      ["src/lib/battle/damage.ts", 11.5 * 1024],
      ["src/features/alchemy/shared/storage/io.ts", 12 * 1024],
      ["src/features/alchemy/shared/stores/run-session-read-port.ts", 18 * 1024],
      ["src/features/alchemy/meta/screens/armory-screen.tsx", 14 * 1024],
      ["unknown.file", 8.5 * 1024],
    ] as const;
    for (const [filePath, maxBytes] of fixtures) {
      expect(measureContext({ paths: [filePath] }).selectedBytes, filePath).toBeLessThanOrEqual(maxBytes);
    }
  });

  it("ratchets preread and total context for every canonical route", () => {
    const measurements = measureAllRoutes();
    expect(new Set(measurements.map((measurement) => measurement.routes.join("+")))).toEqual(
      new Set(Object.keys(ROUTE_CONTEXT_BUDGETS)),
    );
    for (const measurement of measurements) {
      const route = measurement.routes[0] ?? "unknown";
      const budget = ROUTE_CONTEXT_BUDGETS[route];
      expect(measurement.selectedBytes, `${route} preread`).toBeLessThanOrEqual(budget?.preread ?? 0);
      expect(measurement.totalContextBytes, `${route} total`).toBeLessThanOrEqual(budget?.total ?? 0);
    }
  });

  it("keeps the routine persistence guard stack bounded", () => {
    const agents = fs.readFileSync("AGENTS.md", "utf8");
    const start = agents.indexOf("## Change guards");
    const end = agents.indexOf("\n## ", start + 1);
    const guardsBytes = start < 0 || end < 0 ? Number.POSITIVE_INFINITY : Buffer.byteLength(agents.slice(start, end));
    const bytes = guardsBytes + fs.statSync(".agents/skills/verifier/SKILL.md").size;
    expect(bytes).toBeLessThanOrEqual(4_096);
  });

  it("marks generated TypeScript as non-authored output", () => {
    for (const filePath of ["src/lib/game-data/assets.generated.ts", "src/lib/validation/metadata.generated.ts"]) {
      expect(fs.readFileSync(filePath, "utf8").split("\n", 1)[0], filePath).toMatch(/generated.*do not edit/iu);
    }
  });
});

describe("compact child output", () => {
  it("keeps a useful first line and bounded tail", () => {
    expect(firstOutputLine("\n\nTimeoutError: locator.click\nstack\n")).toBe("TimeoutError: locator.click");
    const output = tailOutput("x".repeat(30), 10);
    expect(Buffer.byteLength(output, "utf8")).toBeLessThanOrEqual(30);
    expect(output).toContain("bytes omitted");
    expect(Buffer.byteLength(tailOutput("🔥".repeat(2_000)), "utf8")).toBeLessThanOrEqual(4_000);
  });

  it("strips terminal control noise from compact output", () => {
    expect(sanitizeOutput("\u001b[31mError\u001b[0m\u0000\nnext")).toBe("Error\nnext");
  });
});
