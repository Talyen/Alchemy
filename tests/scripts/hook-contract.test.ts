import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

describe("hook and push gate contract", () => {
  it("aligns lefthook, package check:push, and documented gate", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const lefthookRaw = readFileSync(join(ROOT, "lefthook.yml"), "utf8");
    const contributing = readFileSync(join(ROOT, "CONTRIBUTING.md"), "utf8");
    const skill = readFileSync(join(ROOT, ".agents/skills/verifier/SKILL.md"), "utf8");

    expect(pkg.scripts["check:push:quick"]).toBeUndefined();
    const push = pkg.scripts["check:push"];
    expect(push).toBeDefined();
    expect(push).toContain("npm ci --dry-run");
    expect(push).toContain("format:check");
    expect(push).toContain("typecheck:all");
    expect(push).toContain("lint");
    expect(push).toContain("check:generated");
    expect(push).toContain("build:verified");
    expect(push).not.toContain("test:e2e");

    expect(lefthookRaw).toContain("push-gate:");
    expect(lefthookRaw).toContain("npm run check:push");
    expect((lefthookRaw.match(/run:/gu) ?? []).length).toBe(3);
    expect(lefthookRaw).not.toContain("check:push:quick");
    expect(lefthookRaw).not.toContain("ALCHEMY_PREPUSH");

    expect(contributing).toContain("npm run check:push");
    expect(contributing).toContain("npm run check:handoff");
    expect(skill).toContain("npm run check:handoff");
    expect(skill).toContain("npm run check:push");
  });

  it("defines check:handoff as the strong completion gate", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["check:handoff"]).toBe("node scripts/check-handoff.mjs");
    const handoffSource = readFileSync(join(ROOT, "scripts/check-handoff.mjs"), "utf8");
    expect(handoffSource).toContain("strict-routes");
    expect(handoffSource).toContain("build:verified");
    expect(handoffSource).toContain("context:hotspots");
    expect(handoffSource).toContain("--run-id");
  });

  it("defines non-mutating verified builds", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["build:verified"]).toContain("build-verified");
    expect(pkg.scripts["build:desktop:verified"]).toContain("build-verified");
    const verifiedSource = readFileSync(join(ROOT, "scripts/build-verified.mjs"), "utf8");
    expect(verifiedSource).toContain("syncArtBarrels");
    expect(verifiedSource).toContain("syncVersionMetadata");
    expect(verifiedSource).toContain("vite");
    const generatedSource = readFileSync(join(ROOT, "scripts/sync-version-metadata.mjs"), "utf8");
    expect(generatedSource).toContain("--check");
    expect(pkg.scripts["check:generated"]).toContain("sync-generated");
    expect(pkg.scripts["docs:check:final"]).toBe("node scripts/check-docs.mjs --final");
    expect(pkg.scripts["docs:check:final"]).not.toContain("archive:plans");
  });
});
