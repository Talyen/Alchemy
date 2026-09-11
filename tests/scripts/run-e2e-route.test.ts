import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { E2E_ROUTES, resolveE2eRoute } from "../../scripts/run-e2e-route.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function routeSpecFiles(route: { args: readonly string[] }): string[] {
  return route.args.filter((arg) => arg.endsWith(".spec.ts"));
}

describe("e2e routes", () => {
  it("resolves every documented route to an existing spec", () => {
    for (const [name, route] of Object.entries(E2E_ROUTES)) {
      const specs = routeSpecFiles(route);
      expect(specs.length, name).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(existsSync(path.join(repoRoot, spec)), `${name} -> ${spec}`).toBe(true);
      }
    }
  });

  it("keeps backward-compatible screen-name aliases", () => {
    expect(resolveE2eRoute("shop")).toBe(E2E_ROUTES.shop);
    expect(resolveE2eRoute("shop-screen")).toBe(E2E_ROUTES.shop);
    expect(resolveE2eRoute("homestead")).toBe(E2E_ROUTES.homestead);
    expect(resolveE2eRoute("homestead-screen")).toBe(E2E_ROUTES.homestead);
  });

  it("keeps a test:e2e:<name> alias for every route", () => {
    const scripts = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).scripts;
    for (const name of Object.keys(E2E_ROUTES)) {
      expect(scripts[`test:e2e:${name}`], name).toBe(`node scripts/run-e2e-route.mjs ${name}`);
    }
  });

  it("rejects unknown routes", () => {
    expect(resolveE2eRoute("not-a-route")).toBeUndefined();
  });
});
