import { describe, expect, it } from "vitest";
import { firstOutputLine, tailOutput } from "../../scripts/lib/compact-output.mjs";
import { measureContext } from "../../scripts/measure-agent-context.mjs";
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

  it("falls back to a safe static check for an unknown path", () => {
    expect(resolveRoutes(["scripts/unknown-tool.mjs"]).map((route) => route.id)).toEqual(["fallback"]);
    expect(resolvePlan(["scripts/unknown-tool.mjs"]).commands.map((command) => command.key)).toEqual(["typecheck"]);
  });

  it("measures only the owner docs for a representative route by default", () => {
    const measurement = measureContext({ paths: ["src/lib/battle/damage.ts"] });
    expect(measurement.docs.map((doc) => doc.path)).toEqual(["AGENTS.md", "docs/REFERENCE.md"]);
    expect(measurement.docs[1]?.section).toBe("Battle Implementation Rules");
    expect(measurement.contextBytes).toBeLessThan(20_000);
    expect(measurement.verificationCommands).toBe(1);
  });
});

describe("compact child output", () => {
  it("keeps a useful first line and bounded tail", () => {
    expect(firstOutputLine("\n\nTimeoutError: locator.click\nstack\n")).toBe("TimeoutError: locator.click");
    const output = tailOutput("x".repeat(30), 10);
    expect(output.length).toBeLessThanOrEqual(60);
    expect(output).toContain("chars omitted");
  });
});
