import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, symlinkSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listArtifactDirsToRemove, measurePath, removePath } from "../../scripts/lib/clean-dev-artifacts.mjs";
import { parseCleanArgs } from "../../scripts/clean-dev-artifacts.mjs";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "alchemy-clean-"));
  tempRoots.push(root);
  return root;
}

describe("clean-dev-artifacts helpers", () => {
  it("preserves evidence and environments unless their explicit selectors are requested", () => {
    const root = makeRoot();
    mkdirSync(join(root, "playwright-report"), { recursive: true });
    mkdirSync(join(root, "dist"), { recursive: true });
    mkdirSync(join(root, "node_modules/.vite"), { recursive: true });
    mkdirSync(join(root, ".cache/lyrics/venv"), { recursive: true });
    writeFileSync(join(root, "playwright-report", "index.html"), "x");

    expect(listArtifactDirsToRemove(root)).toEqual([join(root, "node_modules/.vite")]);
    expect(listArtifactDirsToRemove(root, { builds: true, reports: true, caches: true })).toEqual([
      join(root, "node_modules/.vite"),
      join(root, ".cache"),
      join(root, "playwright-report"),
      join(root, "dist"),
    ]);
  });

  it("measures nested artifacts without following links or deleting their external targets", () => {
    const root = makeRoot();
    const external = makeRoot();
    const dir = join(root, "reports");
    mkdirSync(join(dir, "nested"), { recursive: true });
    writeFileSync(join(dir, "a.txt"), "abcd");
    writeFileSync(join(dir, "nested", "b.txt"), "12345");
    writeFileSync(join(external, "source.wav"), "protected source");
    symlinkSync(external, join(dir, "external"));
    symlinkSync(dir, join(dir, "cycle"));
    const linkBytes = lstatSync(join(dir, "external")).size + lstatSync(join(dir, "cycle")).size;
    expect(measurePath(dir)).toEqual({ path: dir, bytes: 9 + linkBytes });
    expect(measurePath(join(dir, "a.txt")).bytes).toBe(4);
    expect(measurePath(join(root, "missing")).bytes).toBe(0);
    removePath(dir);
    expect(existsSync(dir)).toBe(false);
    expect(existsSync(join(external, "source.wav"))).toBe(true);
  });

  it("preserves the shared Vite cache when cleaning a worktree with linked dependencies", () => {
    const root = makeRoot();
    const dependencies = makeRoot();
    mkdirSync(join(dependencies, ".vite"));
    writeFileSync(join(dependencies, ".vite", "cache.json"), "shared cache");
    symlinkSync(dependencies, join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    mkdirSync(join(root, "reports"));

    const targets = listArtifactDirsToRemove(root, { builds: true });
    expect(targets).toEqual([]);
    for (const target of targets) removePath(target);
    expect(existsSync(join(root, "reports"))).toBe(true);
    expect(existsSync(join(dependencies, ".vite", "cache.json"))).toBe(true);
  });
});

describe("parseCleanArgs", () => {
  it("rejects unknown flags", () => {
    expect(() => parseCleanArgs(["--browsers"])).toThrow(/Unknown flags/);
  });

  it("rejects positional arguments separately from flags", () => {
    expect(() => parseCleanArgs(["reports"])).toThrow(/Unexpected arguments/);
  });
});
