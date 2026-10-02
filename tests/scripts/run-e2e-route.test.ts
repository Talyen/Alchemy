import fs, { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { E2E_ROUTES, resolveE2eRoute } from "../../scripts/run-e2e-route.mjs";
import { acquireLocalTestLane } from "../../scripts/lib/verification/local-test-lane.mjs";
import { sourceOutline } from "../../scripts/lib/agent/source-outline.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function routeSpecFiles(route: { args: readonly string[] }): string[] {
  return route.args.filter((arg) => arg.endsWith(".spec.ts"));
}

describe("e2e routes", () => {
  it.each([{ args: [] }, { args: ["--live"] }])(
    "refuses an occupied test lane before starting Playwright (%j)",
    async ({ args }) => {
      const lane = await acquireLocalTestLane(0);
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-e2e-lane-"));
      try {
        fs.cpSync(path.join(repoRoot, "scripts"), path.join(root, "scripts"), { recursive: true });
        const laneModule = path.join(root, "scripts/lib/verification/local-test-lane.mjs");
        fs.writeFileSync(laneModule, fs.readFileSync(laneModule, "utf8").replace("48157", String(lane.port)));
        const spec = path.join(root, "tests/e2e/specs/audio-sfx.spec.ts");
        fs.mkdirSync(path.dirname(spec), { recursive: true });
        fs.writeFileSync(spec, "");
        const cli = path.join(root, "node_modules/@playwright/test/cli.js");
        fs.mkdirSync(path.dirname(cli), { recursive: true });
        fs.writeFileSync(cli, "require('node:fs').writeFileSync('browser-started', 'unexpected');");
        const result = spawnSync(process.execPath, ["scripts/run-e2e-route.mjs", "audio", ...args], {
          cwd: root,
          encoding: "utf8",
          timeout: 10_000,
        });
        expect(result.status, result.stderr).toBe(1);
        expect(result.stdout + result.stderr).toContain("no tests were started");
        expect(fs.existsSync(path.join(root, "browser-started"))).toBe(false);
      } finally {
        await lane.release();
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
  );

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

  it("filtered routes select a retained journey instead of an empty test set", () => {
    for (const [name, route] of Object.entries(E2E_ROUTES)) {
      const args: readonly string[] = route.args;
      const grepIndex = args.findIndex((arg) => arg === "-g" || arg === "--grep");
      if (grepIndex < 0) continue;
      const pattern = new RegExp(args[grepIndex + 1]!);
      const tests = routeSpecFiles(route).flatMap((spec) => sourceOutline(repoRoot, spec, { tests: true }));
      expect(
        tests.some((test) => pattern.test(test.name)),
        `${name} selects no retained journey`,
      ).toBe(true);
    }
  });

  it("exposes routes through the single test:e2e:route entry instead of per-route aliases", () => {
    const scripts = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).scripts;
    expect(scripts["test:e2e:route"]).toBe("node scripts/run-e2e-route.mjs");
    for (const name of Object.keys(E2E_ROUTES)) {
      expect(scripts[`test:e2e:${name}`], name).toBeUndefined();
    }
  });

  it("rejects unknown routes", () => {
    for (const name of ["not-a-route", "constructor", "toString", "__proto__"]) {
      expect(resolveE2eRoute(name), name).toBeUndefined();
    }
  });
});
