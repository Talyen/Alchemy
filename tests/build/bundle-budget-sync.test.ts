import { afterEach, describe, expect, it, vi } from "vitest";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkBundleBudget } from "../../scripts/check-bundle-budget.mjs";
import { BUDGETS, CHUNK_SIZE_WARNING_KB } from "../../scripts/lib/verification/bundle-budget.mjs";

const tempDirs: string[] = [];

function createAssetDirectory(assets: Record<string, number>): string {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "alchemy-bundle-budget-")));
  tempDirs.push(directory);
  for (const [name, bytes] of Object.entries(assets)) {
    mkdirSync(dirname(join(directory, name)), { recursive: true });
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

  it.each(["empty script", "directory"])("rejects an unusable entry (%s)", (entry) => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const directory = createAssetDirectory({ "vendor-a.js": 100 });
    const index = join(directory, "index-AbC_1.js");
    if (entry === "directory") mkdirSync(index);
    else writeFileSync(index, "");
    expect(checkBundleBudget(directory)).toBe(false);
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

  it("recognizes Vite entry hashes containing uppercase and URL-safe characters", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const directory = createAssetDirectory({
      "index-DlKnTbxz_-.js": 100,
      "vendor-DZZfAojr.js": CHUNK_SIZE_WARNING_KB * 1024 + 1,
    });

    expect(checkBundleBudget(directory)).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("fails closed when no entry chunk matches", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const directory = createAssetDirectory({
      "vendor-a.js": CHUNK_SIZE_WARNING_KB * 1024 + 1,
      "runtime-b.js": 100,
    });

    expect(checkBundleBudget(directory)).toBe(false);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("index chunk not found"));
  });

  it.each(["vendor-a.js", "chunks/vendor-a.js"])("includes %s in the aggregate JavaScript budget", (vendor) => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const directory = createAssetDirectory({
      "index-AbC_1.js": 100,
      [vendor]: BUDGETS.totalJsMaxBytes,
    });

    expect(checkBundleBudget(directory)).toBe(false);
  });

  it("warns without failing once totals pass 95% of the budget", () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const directory = createAssetDirectory({
      "index-AbC_1.js": BUDGETS.totalJsWarnBytes,
      "vendor-a.js": 1,
    });

    expect(checkBundleBudget(directory)).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("WARN"));
  });

  it.each(["full", "demo"])("checks the %s edition from outside the checkout", (edition) => {
    const root = createAssetDirectory({});
    const repo = new URL("../../", import.meta.url);
    for (const file of [
      "scripts/check-bundle-budget.mjs",
      "scripts/lib/verification/bundle-budget.mjs",
      "scripts/lib/release/game-edition.mjs",
      "scripts/lib/repository-paths.mjs",
      "scripts/lib/is-main-module.mjs",
      "game-edition.mjs",
    ]) {
      const target = join(root, file);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(new URL(file, repo), target);
    }
    const assets = join(root, edition === "demo" ? "dist-demo" : "dist", "assets");
    mkdirSync(assets, { recursive: true });
    writeFileSync(join(assets, "index-AbC_1.js"), Buffer.alloc(100));
    const caller = join(root, "caller");
    mkdirSync(caller);
    const result = spawnSync(process.execPath, [join(root, "scripts/check-bundle-budget.mjs")], {
      cwd: caller,
      encoding: "utf8",
      env: { ...process.env, ALCHEMY_EDITION: edition },
      timeout: 5_000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`[bundle-budget] pass ${assets}`);
  });
});
