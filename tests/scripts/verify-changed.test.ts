import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { firstOutputLine, sanitizeOutput, tailOutput } from "../../scripts/lib/compact-output.mjs";
import { measureAllRoutes, measureContext } from "../../scripts/measure-agent-context.mjs";
import { formatPlan, resolvePlan, resolveRoutes } from "../../scripts/verify-changed.mjs";

describe("verify-changed route catalog", () => {
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
      ["src/lib/battle/damage.ts", 11 * 1024],
      ["src/features/alchemy/shared/storage/io.ts", 12 * 1024],
      ["src/features/alchemy/shared/stores/run-session-read-port.ts", 18 * 1024],
      ["src/features/alchemy/meta/screens/armory-screen.tsx", 14 * 1024],
      ["unknown.file", 8.5 * 1024],
    ] as const;
    for (const [filePath, maxBytes] of fixtures) {
      expect(measureContext({ paths: [filePath] }).selectedBytes, filePath).toBeLessThanOrEqual(maxBytes);
    }
  });

  it("keeps the routine persistence skill stack bounded", () => {
    const bytes = [
      ".agents/skills/blast-radius/SKILL.md",
      ".agents/skills/unslop/SKILL.md",
      ".agents/skills/verifier/SKILL.md",
    ].reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
    expect(bytes).toBeLessThanOrEqual(6_304);
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
    expect(output.length).toBeLessThanOrEqual(60);
    expect(output).toContain("chars omitted");
  });

  it("strips terminal control noise from compact output", () => {
    expect(sanitizeOutput("\u001b[31mError\u001b[0m\u0000\nnext")).toBe("Error\nnext");
  });
});
