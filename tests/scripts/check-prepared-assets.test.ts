import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ root: "" }));
vi.mock("../../scripts/prepare-assets.mjs", () => ({ prepareAssets: vi.fn() }));
vi.mock("../../scripts/lib/sync-generated-helpers.mjs", () => ({ resolveRootDir: () => fixture.root }));

fixture.root = mkdtempSync(join(tmpdir(), "alchemy-prepared-assets-"));
const { prepareAssets } = await import("../../scripts/prepare-assets.mjs");
const { checkPreparedAssets } = await import("../../scripts/check-prepared-assets.mjs");
const metadata = "src/lib/validation/metadata.generated.ts";
const art = "src/assets/optimized/card.webp";

function write(relativePath: string, contents: string) {
  const target = join(fixture.root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

describe("checkPreparedAssets", () => {
  beforeEach(() => {
    rmSync(fixture.root, { recursive: true, force: true });
    mkdirSync(fixture.root);
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "");
    vi.mocked(prepareAssets).mockReset();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterAll(() => {
    rmSync(fixture.root, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("refuses to run when asset preparation is skipped", async () => {
    vi.stubEnv("ALCHEMY_SKIP_ASSETS", "1");
    await expect(checkPreparedAssets()).rejects.toThrow("cannot run with ALCHEMY_SKIP_ASSETS=1");
    expect(prepareAssets).not.toHaveBeenCalled();
  });

  it("accepts unchanged outputs", async () => {
    write(art, "current art");
    await expect(checkPreparedAssets()).resolves.toBeUndefined();
    expect(readFileSync(join(fixture.root, art), "utf8")).toBe("current art");
  });

  it("detects and restores version metadata changes", async () => {
    write(metadata, "old version");
    vi.mocked(prepareAssets).mockImplementation(async () => write(metadata, "new version"));
    await expect(checkPreparedAssets()).rejects.toThrow("metadata.generated.ts");
    expect(readFileSync(join(fixture.root, metadata), "utf8")).toBe("old version");
  });

  it("restores changed and deleted outputs and removes new files after preparation fails", async () => {
    write(art, "original art");
    write(metadata, "original version");
    const added = "public/sounds/new.ogg";
    const failure = new Error("prepare exploded");
    vi.mocked(prepareAssets).mockImplementation(async () => {
      write(art, "changed art");
      rmSync(join(fixture.root, metadata));
      write(added, "new sound");
      throw failure;
    });
    await expect(checkPreparedAssets()).rejects.toBe(failure);
    expect(readFileSync(join(fixture.root, art), "utf8")).toBe("original art");
    expect(readFileSync(join(fixture.root, metadata), "utf8")).toBe("original version");
    expect(existsSync(join(fixture.root, added))).toBe(false);
  });
});
