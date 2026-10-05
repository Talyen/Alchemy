import { mkdtempSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";

import { parseKnownFlags } from "../../scripts/lib/cli-args.mjs";
import { UsageError } from "../../scripts/lib/script-run.mjs";
import { runStreamCommand, runTaskCommand } from "../../scripts/lib/run-command.mjs";
import { resolvePrettierTargets } from "../../scripts/run-prettier.mjs";
import { runCiLint } from "../../scripts/lint-ci.mjs";

describe("script consolidation", () => {
  it("parses simple flags, values, shorts, and passthrough", () => {
    const parsed = parseKnownFlags(
      ["input file", "--check", "-c", "--mode=web", "--mode", "desktop=demo", "-m=native", "--", "--mode=ignored"],
      {
        check: { short: "c" },
        mode: { short: "m", takesValue: true },
      },
    );
    expect(parsed).toEqual({
      flags: new Set(["check"]),
      values: new Map([["mode", ["web", "desktop=demo", "native"]]]),
      rest: ["input file", "--mode=ignored"],
    });
    for (const option of ["--bogus", "-mc", "--=oops", "--constructor", "--toString", "--__proto__", "--check=true"]) {
      expect(() => parseKnownFlags([option], { check: { short: "c" } }), option).toThrow(UsageError);
    }
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

  it("streams long-running commands through the shared runner", () => {
    const passed = runStreamCommand(process.execPath, ["-e", "process.exit(0)"]);
    expect(passed.status).toBe(0);
    expect(passed.elapsedMs).toBeGreaterThanOrEqual(0);
    const failed = runStreamCommand(process.execPath, ["-e", "process.exit(3)"]);
    expect(failed.status).toBe(3);
    const timedOut = runStreamCommand(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeout: 100 });
    expect(timedOut.error).toBeDefined();
  });

  it("captures one-shot task output and exposes only a compact result", async () => {
    const root = mkdtempSync(join(tmpdir(), "task-command-"));
    try {
      const logPath = join(root, "task.log");
      const result = await runTaskCommand(
        process.execPath,
        ["-e", 'console.log("noise".repeat(5000)); process.exit(0)'],
        { cwd: root, label: "bounded task", logPath },
      );
      expect(result.status).toBe(0);
      expect(statSync(logPath).size).toBeGreaterThan(20_000);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("compacts the aggregate CI static gate while retaining step logs", async () => {
    const root = mkdtempSync(join(tmpdir(), "lint-ci-"));
    try {
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const runner = vi.fn(async (_command: string, _args: string[], options: Record<string, unknown>) => ({
        status: 0,
        elapsedMs: 1,
        output: "Tests  3 passed (3)",
        logPath: String(options.logPath),
      }));
      expect(await runCiLint({ rootDir: root, runner })).toBe(0);
      expect(runner.mock.calls.map(([command, args]) => [command, args])).toEqual([
        ["npm", ["run", "check:static"]],
        ["npm", ["run", "docs:check"]],
        ["npm", ["run", "deadcode"]],
        ["npm", ["run", "lint:boundaries"]],
        ["npm", ["run", "lint:architecture-smoke"]],
        ["npx", ["playwright", "test", "--list", "--project=chromium"]],
      ]);
      expect(log.mock.calls.flat().join("\n")).toContain("CI static checks: 6/6 passed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
