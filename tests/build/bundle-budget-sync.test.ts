import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUDGETS, checkBundleBudget } from "../../scripts/check-bundle-budget.mjs";

const tempDirs: string[] = [];

function createAssetDirectory(assets: Record<string, number>): string {
  const directory = mkdtempSync(join(tmpdir(), "alchemy-bundle-budget-"));
  tempDirs.push(directory);
  for (const [name, bytes] of Object.entries(assets)) {
    writeFileSync(join(directory, name), Buffer.alloc(bytes));
  }
  return directory;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("bundle budget sync", () => {
  it("chunkSizeWarningLimit matches BUDGETS.indexMaxBytes", () => {
    const viteConfig = readFileSync("vite.config.ts", "utf8");
    const match = viteConfig.match(/chunkSizeWarningLimit:\s*(\d+)/);
    expect(match, "chunkSizeWarningLimit not found in vite.config.ts").not.toBeNull();
    const limitKb = Number(match![1]);
    expect(limitKb * 1024).toBe(BUDGETS.indexMaxBytes);
  });

  it("recognizes Vite entry hashes containing uppercase and URL-safe characters", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const directory = createAssetDirectory({
      "index-DlKnTbxz_-.js": 100,
      "vendor-DZZfAojr.js": BUDGETS.indexMaxBytes + 1,
    });

    expect(checkBundleBudget(directory)).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("checks the largest asset when no entry chunk matches", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const directory = createAssetDirectory({
      "vendor-a.js": BUDGETS.indexMaxBytes + 1,
      "runtime-b.js": 100,
    });

    expect(checkBundleBudget(directory)).toBe(false);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("index pattern not matched"));
  });

  it("fails when the matched entry exceeds its budget", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const directory = createAssetDirectory({ "index-AbC_1.js": BUDGETS.indexMaxBytes + 1 });

    expect(checkBundleBudget(directory)).toBe(false);
  });

  it("fails when aggregate JavaScript exceeds its budget", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const directory = createAssetDirectory({
      "index-AbC_1.js": 100,
      "vendor-a.js": BUDGETS.totalJsMaxBytes,
    });

    expect(checkBundleBudget(directory)).toBe(false);
  });
});
