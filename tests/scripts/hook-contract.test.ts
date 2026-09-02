import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
    expect(lefthook).toContain("npm run check -- --diff");
    expect(contributing).toContain("npm run verify -- --diff");
    expect(contributing).toContain("npm run check -- --diff");
    expect(skill).toContain("npm run check -- --diff");
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
    expect(pkg.scripts["lint:ci"]).toContain("npm run check:static");
    expect(workflow).toContain("run: npm run lint:ci");
    expect(workflow).not.toContain("check:test-owners");
    expect(workflow).not.toContain("ci:verify-plan");
  });
});
