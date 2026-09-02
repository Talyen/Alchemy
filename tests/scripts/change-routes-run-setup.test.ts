import { describe, expect, it } from "vitest";
import { resolveRoutes, resolveRoutePlan } from "../../scripts/lib/change-routes.mjs";

describe("run-setup verification routing", () => {
  it("routes run-setup source to focused coverage without unknown", () => {
    const routes = resolveRoutes(["src/features/alchemy/run-setup/run/content-system-navigation.ts"]);
    expect(routes.map((r) => r.id)).toContain("run-setup");
    expect(routes.some((r) => r.id === "unknown")).toBe(false);
  });

  it("routes run-setup screen to focused coverage without unknown", () => {
    const routes = resolveRoutes(["src/app/screen-routes/run-setup-routes.tsx"]);
    expect(routes.map((r) => r.id)).toContain("run-setup");
    expect(routes.some((r) => r.id === "unknown")).toBe(false);
  });

  it("routes shell navigation hook to run-setup without unknown", () => {
    const routes = resolveRoutes(["src/features/alchemy/shell/use-content-system-navigation.ts"]);
    expect(routes.map((r) => r.id)).toContain("run-setup");
    expect(routes.some((r) => r.id === "unknown")).toBe(false);
  });

  it("selects unit-run-setup for run-setup paths", () => {
    const plan = resolveRoutePlan(["src/features/alchemy/run-setup/run/content-system-navigation.ts"]);
    const keys = plan.commands.map((c) => c.key);
    expect(keys).toContain("unit-run-setup");
    expect(keys).not.toContain("unknown");
  });

  it("does not require unknown fallback for catalog change", () => {
    const routes = resolveRoutes(["src/features/alchemy/shared/config/game-data-catalog.ts"]);
    expect(routes.map((r) => r.id)).toContain("run-setup");
    expect(routes.some((r) => r.id === "unknown")).toBe(false);
  });
});
