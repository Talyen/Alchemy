import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkBundleBudget } from "../../scripts/check-bundle-budget.mjs";
import { BUDGETS, CHUNK_SIZE_WARNING_KB } from "../../scripts/lib/bundle-budget.mjs";

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
  it("rejects missing, empty, and non-JavaScript build outputs", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const empty = createAssetDirectory({});
    expect(checkBundleBudget(join(empty, "missing"))).toBe(false);
    expect(checkBundleBudget(empty)).toBe(false);
    expect(checkBundleBudget(createAssetDirectory({ "styles.css": 100 }))).toBe(false);
  });

  it("excludes sourcemaps from the JavaScript budget", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const directory = createAssetDirectory({
      "index-AbC_1.js": 100,
      "index-AbC_1.js.map": BUDGETS.totalJsMaxBytes + 1,
    });
    expect(checkBundleBudget(directory)).toBe(true);
  });

  it("rejects a missing build even when another requested build passes", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const built = createAssetDirectory({ "index-AbC_1.js": 100 });
    expect(checkBundleBudget([built, join(built, "missing")])).toBe(false);
  });

  it("chunkSizeWarningLimit matches BUDGETS.indexMaxBytes", () => {
    expect(CHUNK_SIZE_WARNING_KB * 1024).toBe(BUDGETS.indexMaxBytes);
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

  it("fails closed when no entry chunk matches", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const directory = createAssetDirectory({
      "vendor-a.js": BUDGETS.indexMaxBytes + 1,
      "runtime-b.js": 100,
    });

    expect(checkBundleBudget(directory)).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("index chunk not found"));
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
