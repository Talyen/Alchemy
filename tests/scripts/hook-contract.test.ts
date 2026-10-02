import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCiLint } from "../../scripts/lint-ci.mjs";

const ROOT = join(import.meta.dirname, "../..");

describe("canonical verification commands", () => {
  it("exposes only verify, check, and release as workflow entry points", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    const lefthook = readFileSync(join(ROOT, "lefthook.yml"), "utf8");
    const contributing = readFileSync(join(ROOT, "CONTRIBUTING.md"), "utf8");
    const skill = readFileSync(join(ROOT, ".agents/skills/verifier/SKILL.md"), "utf8");

    expect(pkg.scripts.verify).toBe("node scripts/verify-changed.mjs");
    expect(pkg.scripts.check).toBe("node scripts/check.mjs");
    expect(pkg.scripts.release).toBe("node scripts/release.mjs");
    for (const removed of ["verify:changed", "check:push", "check:handoff"])
      expect(pkg.scripts[removed]).toBeUndefined();
    expect(lefthook).toContain("npm run check -- --pre-push");
    expect(lefthook).toContain("use_stdin: true");
    expect(contributing).toContain("npm run verify -- --diff");
    expect(contributing).toContain("npm run check -- --diff");
    expect(skill).toMatch(/npm run check -- (?:--diff|<paths>)/);
  });

  it("makes ordinary builds pure and generated-output-validating", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toBe("node scripts/build-verified.mjs");
    expect(pkg.scripts["build:desktop"]).toBe("node scripts/build-verified.mjs --desktop");
    for (const removed of [
      "prebuild",
      "prebuild:desktop",
      "build:verified",
      "build:desktop:verified",
      "dist:desktop:verified",
    ]) {
      expect(pkg.scripts[removed]).toBeUndefined();
    }
    expect(readFileSync(join(ROOT, "scripts/build-verified.mjs"), "utf8")).toContain("syncGenerated");
  });

  it("uses the same static aggregate locally and in CI", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    const workflow = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
    const check = readFileSync(join(ROOT, "scripts/check.mjs"), "utf8");
    const lintCi = readFileSync(join(ROOT, "scripts/lint-ci.mjs"), "utf8");
    expect(pkg.scripts["lint:ci"]).toBe("node scripts/lint-ci.mjs");
    expect(lintCi).toContain('"check:static"');
    expect(check).toContain('["run", "lint:ci"]');
    expect(workflow).toContain("run: npm run lint:ci");
    expect(workflow).not.toContain("check:test-owners");
    expect(workflow).not.toContain("ci:verify-plan");
  });

  it("finishes independent static checks after failures and still returns failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "alchemy-static-settled-"));
    try {
      const runner = async (_command: string, _args: string[], options: Record<string, unknown>) => {
        const name = basename(String(options.logPath), ".log");
        const status = name === "dead-code" ? 1 : 0;
        await new Promise((resolve) => {
          setTimeout(resolve, status === 1 ? 0 : 250);
        });
        writeFileSync(join(root, `${name}.done`), "done");
        return { status, elapsedMs: 1, output: status === 0 ? "passed" : "failed", logPath: String(options.logPath) };
      };
      const result = await runCiLint({
        rootDir: root,
        runner,
      });
      expect(result).toBe(1);
      expect(
        readdirSync(root)
          .filter((name) => name.endsWith(".done"))
          .sort(),
      ).toEqual(
        [
          "static-checks",
          "documentation-checks",
          "dead-code",
          "dependency-boundaries",
          "architecture-smoke",
          "Playwright-collection",
        ]
          .map((name) => `${name}.done`)
          .sort(),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("runs critical browser journeys on every push and keeps manual save selection unfiltered", () => {
    const workflow = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
    const e2eJob = workflow.split("  e2e:\n")[1].split("  ship-gate:\n")[0];
    expect(e2eJob).not.toMatch(/^ {4}if:/mu);
    expect(e2eJob).toContain("npm run test:e2e:critical");
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["test:e2e:critical"]).toContain("--grep @critical");
    expect(pkg.scripts["test:ship:e2e"]).not.toContain("--grep");
  });
});
