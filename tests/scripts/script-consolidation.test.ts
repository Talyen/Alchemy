import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { INLINE_ARGS_BYTES, RELATED_SELECTION_BYTES } from "../../scripts/lib/selection-budgets.mjs";
import { VITEST_MAX_WORKERS } from "../../scripts/lib/test-concurrency.mjs";
import { parseKnownFlags } from "../../scripts/lib/cli-args.mjs";
import { UsageError } from "../../scripts/lib/script-run.mjs";
import { runStreamCommand } from "../../scripts/lib/run-command.mjs";
import { resolvePrettierTargets } from "../../scripts/run-prettier.mjs";

const ROOT = process.cwd();

describe("script consolidation", () => {
  it("keeps same-value byte budgets as distinct named exports", () => {
    expect(INLINE_ARGS_BYTES).toBe(8_000);
    expect(RELATED_SELECTION_BYTES).toBe(8_000);
    expect(readFileSync(join(ROOT, "scripts/check.mjs"), "utf8")).toContain("INLINE_ARGS_BYTES");
    expect(readFileSync(join(ROOT, "scripts/lib/change-routes.mjs"), "utf8")).toContain("RELATED_SELECTION_BYTES");
  });

  it("pins the ship-gate worker budget in one owner", () => {
    expect(VITEST_MAX_WORKERS).toBe(4);
    expect(readFileSync(join(ROOT, "scripts/run-ship-unit.mjs"), "utf8")).toContain("VITEST_MAX_WORKERS");
  });

  it("parses simple flags, values, shorts, and passthrough", () => {
    expect(parseKnownFlags(["--check"], { check: {}, write: {} }).flags.has("check")).toBe(true);
    expect(parseKnownFlags(["--mode", "desktop"], { mode: { takesValue: true } }).values.get("mode")).toEqual([
      "desktop",
    ]);
    expect(parseKnownFlags(["--mode=desktop"], { mode: { takesValue: true } }).values.get("mode")).toEqual(["desktop"]);
    expect(parseKnownFlags(["-m", "desktop"], { mode: { short: "m", takesValue: true } }).values.get("mode")).toEqual([
      "desktop",
    ]);
    expect(parseKnownFlags(["--check", "--", "--not-a-flag"], { check: {} }).rest).toEqual(["--not-a-flag"]);
    expect(() => parseKnownFlags(["--bogus"], { check: {} })).toThrow(UsageError);
    expect(() => parseKnownFlags(["--mode"], { mode: { takesValue: true } })).toThrow(UsageError);
    expect(() => parseKnownFlags(["--mode=desktop"], { check: {} })).toThrow(UsageError);
    expect(() => parseKnownFlags(["-m=desktop"], { check: {} })).toThrow(UsageError);
  });

  it("resolves prettier targets through the shared parser", () => {
    expect(resolvePrettierTargets(["--check"]).mode).toBe("--check");
    expect(resolvePrettierTargets(["--write", "src/App.tsx"]).targets).toEqual(["src/App.tsx"]);
    expect(resolvePrettierTargets(["--check", "package-lock.json", "src/App.tsx"]).targets).toEqual(["src/App.tsx"]);
    expect(() => resolvePrettierTargets([])).toThrow(UsageError);
    expect(() => resolvePrettierTargets(["--check", "--write"])).toThrow(UsageError);
  });

  it("forwards consolidated npm entries instead of separate implementations", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["audit:all"]).toBe("node scripts/audit.mjs --all");
    expect(pkg.scripts["assets:check"]).toBe("node scripts/assets.mjs --check");
  });

  it("keeps local static fast and CI static complete", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["check:static"]).not.toContain("lint:boundaries");
    expect(pkg.scripts["check:static"]).not.toContain("lint:architecture-smoke");
    expect(pkg.scripts["lint:ci"]).toContain("npm run check:static");
    expect(pkg.scripts["lint:ci"]).toContain("npm run lint:boundaries");
    expect(pkg.scripts["lint:ci"]).toContain("npm run lint:architecture-smoke");
  });

  it("streams long-running commands through the shared runner", () => {
    const passed = runStreamCommand(process.execPath, ["-e", "process.exit(0)"]);
    expect(passed.status).toBe(0);
    expect(passed.elapsedMs).toBeGreaterThanOrEqual(0);
    const failed = runStreamCommand(process.execPath, ["-e", "process.exit(3)"]);
    expect(failed.status).toBe(3);
  });
});
