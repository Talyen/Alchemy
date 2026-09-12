import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTES } from "../../scripts/lib/change-routes.mjs";

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
    expect(pkg.scripts["lint:ci"]).toContain("npm run check:static");
    expect(check).toContain('["run", "lint:ci"]');
    expect(workflow).toContain("run: npm run lint:ci");
    expect(workflow).not.toContain("check:test-owners");
    expect(workflow).not.toContain("ci:verify-plan");
  });

  it("finishes independent nested static checks after failures and still returns failure", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    const root = mkdtempSync(join(tmpdir(), "alchemy-static-settled-"));
    try {
      const scripts: Record<string, string> = {};
      for (const name of ["check:static", "lint:ci", "typecheck:all"]) {
        scripts[name] = (pkg.scripts[name] ?? "").replace(
          /\bconcurrently\b/gu,
          `node "${join(ROOT, "node_modules/concurrently/dist/bin/concurrently.js")}"`,
        );
      }
      const leaves = [
        "check:generated",
        "format:check",
        "lint",
        "lint:boundaries",
        "lint:architecture-smoke",
        "docs:check",
        "deadcode",
      ];
      for (const name of leaves)
        scripts[name] = `node checker.cjs ${name} ${name === "format:check" || name === "deadcode" ? 1 : 0}`;
      scripts["typecheck:all"] =
        scripts["typecheck:all"]?.replace(
          /tsc(?: -p tsconfig.test.json)? --noEmit/gu,
          (command) => `node checker.cjs ${command.includes("tsconfig.test") ? "types-test" : "types-source"} 0`,
        ) ?? "";
      scripts["lint:ci"] =
        scripts["lint:ci"]?.replace("npx playwright test --list --project=chromium", "node checker.cjs collection 0") ??
        "";
      writeFileSync(join(root, "package.json"), JSON.stringify({ private: true, scripts }));
      writeFileSync(
        join(root, "checker.cjs"),
        `const fs = require("node:fs");
const [name, code] = process.argv.slice(2);
setTimeout(() => { fs.writeFileSync(name.replaceAll(":", "-") + ".done", "done"); process.exit(Number(code)); }, code === "1" ? 0 : 250);`,
      );
      const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "lint:ci"], {
        cwd: root,
        encoding: "utf8",
        timeout: 20_000,
      });
      expect(result.status, result.stdout + result.stderr).toBe(1);
      expect(
        readdirSync(root)
          .filter((name) => name.endsWith(".done"))
          .sort(),
      ).toEqual(
        [...leaves.map((name) => name.replaceAll(":", "-")), "types-source", "types-test", "collection"]
          .map((name) => `${name}.done`)
          .sort(),
      );
      expect(result.stdout + result.stderr).not.toContain("SIGTERM");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 25_000);

  it("keeps the complete save browser gate aligned with canonical save paths and explicit CI triggers", () => {
    const workflow = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
    const saveFilter = workflow.match(/^ {12}save:\n((?: {14}- .*\n)+)/mu)?.[1];
    expect(saveFilter).toBeDefined();
    const patterns = [...(saveFilter ?? "").matchAll(/- "([^"]+)"/gu)].map((match) => match[1]);
    const saveRoute = ROUTES.find((route) => route.id === "save");
    expect(saveRoute).toBeDefined();
    expect(patterns.toSorted()).toEqual(
      [
        ...(saveRoute?.patterns ?? []),
        ".github/**",
        "package.json",
        "package-lock.json",
        "src/lib/platform.ts",
        "src/features/alchemy/shell/use-alchemy-run-controller*",
        "tests/fixtures/legacy-saves*",
        "tests/e2e/mid-combat-save*",
        "tests/e2e/specs/save-*",
      ].toSorted(),
    );
    expect(workflow).toMatch(
      /save-gate:\n {4}needs: \[changes, build\]\n {4}if: github\.event_name == 'workflow_dispatch' \|\| needs\.changes\.outputs\.save == 'true'/u,
    );
  });
});
