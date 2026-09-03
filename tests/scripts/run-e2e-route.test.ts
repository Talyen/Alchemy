import { existsSync } from "node:fs";
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

  it("keeps the shop alias on the shop screen journey", () => {
    expect(resolveE2eRoute("shop")).toBe(E2E_ROUTES["shop-screen"]);
  });

  it("rejects unknown routes", () => {
    expect(resolveE2eRoute("not-a-route")).toBeUndefined();
  });
});
