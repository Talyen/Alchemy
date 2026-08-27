import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BUILD_ARTIFACT_DIRS,
  DEFAULT_ARTIFACT_DIRS,
  formatBytes,
  listArtifactDirsToRemove,
  measurePath,
  removePath,
} from "../../scripts/lib/clean-dev-artifacts.mjs";
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
  it("lists only existing default artifact dirs unless builds is requested", () => {
    const root = makeRoot();
    mkdirSync(join(root, "playwright-report"), { recursive: true });
    mkdirSync(join(root, "dist"), { recursive: true });
    writeFileSync(join(root, "playwright-report", "index.html"), "x");

    expect(listArtifactDirsToRemove(root)).toEqual([join(root, "playwright-report")]);
    expect(listArtifactDirsToRemove(root, { builds: true })).toEqual([
      join(root, "playwright-report"),
      join(root, "dist"),
    ]);
  });

  it("covers the documented default and build relative dirs", () => {
    expect(DEFAULT_ARTIFACT_DIRS).toContain("test-results");
    expect(DEFAULT_ARTIFACT_DIRS).toContain("node_modules/.vite");
    expect(BUILD_ARTIFACT_DIRS).toEqual(["dist", "release-desktop"]);
  });

  it("measures nested file sizes and removes trees", () => {
    const root = makeRoot();
    const dir = join(root, "reports");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "a.txt"), "abcd");
    expect(measurePath(dir).bytes).toBe(4);
    removePath(dir);
    expect(existsSync(dir)).toBe(false);
  });

  it("formats byte sizes for logs", () => {
    expect(formatBytes(500)).toBe("500B");
    expect(formatBytes(2048)).toBe("2KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0MB");
  });
});

describe("parseCleanArgs", () => {
  it.each(["-h", "--help"])("accepts the %s help alias", (flag) => {
    expect(parseCleanArgs([flag])).toMatchObject({ help: true });
  });

  it("parses --all as builds + processes", () => {
    expect(parseCleanArgs(["--all"])).toMatchObject({
      builds: true,
      processes: true,
      includeDevPort: false,
      dryRun: false,
    });
  });

  it("rejects unknown flags", () => {
    expect(() => parseCleanArgs(["--browsers"])).toThrow(/Unknown flags/);
  });

  it("rejects positional arguments separately from flags", () => {
    expect(() => parseCleanArgs(["reports"])).toThrow(/Unexpected arguments/);
  });
});
