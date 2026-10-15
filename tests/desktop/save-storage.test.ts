import { createRequire } from "node:module";
import * as filesystem from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { deferred } from "../helpers/deferred";

const require = createRequire(import.meta.url);
interface NativeSaveStorage {
  read: (slot?: "recovery") => Promise<{ candidates: string[]; localReadFailed: boolean }>;
  write: (data: string, slot?: "recovery") => Promise<boolean>;
  clear: () => Promise<boolean>;
  readDemoImportSource: () => Promise<unknown>;
  completeDemoInitialization: () => Promise<boolean>;
}
const { createDesktopSaveStorage } = require("../../desktop/save-storage.cjs") as {
  createDesktopSaveStorage: (options: object) => NativeSaveStorage;
};
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => filesystem.rm(directory, { recursive: true, force: true })),
  );
});
async function fixture(overrides = {}) {
  const directory = await filesystem.mkdtemp(path.join(tmpdir(), "alchemy-native-save-"));
  directories.push(directory);
  const slots = Object.fromEntries(
    ["primary", "recovery"].map((slot) => {
      const file = path.join(directory, `${slot}.json`);
      return [slot, { file, tmp: `${file}.tmp`, backups: [1, 2, 3].map((index) => `${file}.bak.${index}`) }];
    }),
  );
  const demoProgress = { complete: vi.fn(async () => true), readSource: vi.fn(async () => ({ initialized: true })) };
  const store = createDesktopSaveStorage({
    slots,
    demoProgress,
    isSavePayload: (data: unknown) => typeof data === "string",
    stampOwner: (data: string) => data,
    ...overrides,
  });
  return { store, demoProgress, directory };
}

it.each(["read", "clear"] as const)(
  "orders native %s after a submitted write across renderer lifetimes",
  async (operation) => {
    const started = deferred<void>();
    const release = deferred<void>();
    const f = await fixture({
      filesystem: {
        ...filesystem,
        mkdir: async (...args: Parameters<typeof filesystem.mkdir>) => {
          started.resolve();
          await release.promise;
          return filesystem.mkdir(...args);
        },
      },
    });
    const write = f.store.write("newest progress");
    await started.promise;
    const next = operation === "read" ? f.store.read() : f.store.clear();
    release.resolve();
    expect(await write).toBe(true);
    if (operation === "read") expect(await next).toEqual({ candidates: ["newest progress"], localReadFailed: false });
    else {
      expect(await next).toBe(true);
      expect((await f.store.read()).candidates).toEqual([]);
    }
  },
);

it("reads an intact backup ring and clears both slots while preserving initialization", async () => {
  const f = await fixture();
  for (const revision of ["oldest", "older", "old", "new", "newest"]) expect(await f.store.write(revision)).toBe(true);
  expect((await f.store.read()).candidates).toEqual(["newest", "new", "old", "older"]);
  expect(await f.store.write("recovery", "recovery")).toBe(true);
  expect(await f.store.clear()).toBe(true);
  expect(f.demoProgress.complete).toHaveBeenCalledWith({ localOnly: true });
  expect((await f.store.read()).candidates).toEqual([]);
  expect((await f.store.read("recovery")).candidates).toEqual([]);
});

it("continues the native lane after failed receipt work and preserves existing progress on a refused clear", async () => {
  const f = await fixture();
  expect(await f.store.write("keep")).toBe(true);
  f.demoProgress.complete.mockResolvedValueOnce(false);
  expect(await f.store.clear()).toBe(false);
  expect((await f.store.read()).candidates).toEqual(["keep"]);
  f.demoProgress.readSource.mockRejectedValueOnce(new Error("source unavailable"));
  await expect(f.store.readDemoImportSource()).rejects.toThrow("source unavailable");
  expect(await f.store.write("later")).toBe(true);
  expect((await f.store.read()).candidates).toEqual(["later", "keep"]);
});
