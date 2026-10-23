import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, writeFile, unlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  saveProfileDirectory,
  createSaveSlots,
  migrateLegacySaveProfile,
  retainLegacyMigrationReceipt,
} = require("../../desktop/save-profile.cjs");
const { createDesktopSaveStorage } = require("../../desktop/save-storage.cjs");
const { isSavePayload } = require("../../desktop/security.cjs");
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

it("isolates Steam accounts, offline progress and receipts while preserving attributable legacy saves", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "alchemy-accounts-"));
  directories.push(base);
  const legacy = JSON.stringify({ steamAccountId: "111", lastSavedAt: 200, gold: 90 });
  await writeFile(path.join(base, "save.json"), legacy);
  const alice = saveProfileDirectory(base, "111");
  const bob = saveProfileDirectory(base, "222");
  const offline = saveProfileDirectory(base, null);
  expect(new Set([alice, bob, offline]).size).toBe(3);
  expect(saveProfileDirectory(base, "111", true)).toBe(base);
  for (const [directory, account] of [
    [alice, "111"],
    [bob, "222"],
    [offline, null],
  ]) {
    await migrateLegacySaveProfile({ base, directory, account, isSavePayload });
  }
  function storage(directory: string) {
    return createDesktopSaveStorage({
      slots: createSaveSlots(directory, ["save.json", "save-recovery.json"]),
      isSavePayload,
      stampOwner: (data: string) => data,
      preserveInitialization: () => retainLegacyMigrationReceipt(directory),
      demoProgress: { complete: async () => true },
    });
  }
  expect((await storage(alice).read()).candidates).toEqual([legacy]);
  expect((await storage(bob).read()).candidates).toEqual([]);
  expect((await storage(offline).read()).candidates).toEqual([]);
  await writeFile(path.join(alice, "demo-initialization.json"), "initialized");
  // Simulate the receipt write failing after startup copied its snapshots.
  await unlink(path.join(alice, "legacy-migration.json"));
  expect(await storage(alice).clear()).toBe(true);
  await migrateLegacySaveProfile({ base, directory: alice, account: "111", isSavePayload });
  expect((await storage(alice).read()).candidates).toEqual([]);
  expect(await readFile(path.join(alice, "demo-initialization.json"), "utf8")).toBe("initialized");
  await expect(readFile(path.join(bob, "demo-initialization.json"))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(path.join(base, "save.json"), "utf8")).toBe(legacy);
});

it("never lets a newer legacy backup replace an established account profile", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "alchemy-accounts-"));
  directories.push(base);
  const directory = saveProfileDirectory(base, "111");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "save.json"), "established progress");
  await writeFile(path.join(base, "save.json.bak.1"), JSON.stringify({ steamAccountId: "111", lastSavedAt: 999 }));
  await migrateLegacySaveProfile({ base, directory, account: "111", isSavePayload });
  await expect(readFile(path.join(directory, "save.json.bak.1"))).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readFile(path.join(directory, "save.json"), "utf8")).toBe("established progress");
});

it("retains local progress when its initialization receipt cannot be preserved", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "alchemy-clear-receipt-"));
  directories.push(directory);
  const slots = createSaveSlots(directory, ["save.json", "save-recovery.json"]);
  await writeFile(slots.primary.file, "acknowledged progress");
  const store = createDesktopSaveStorage({
    slots,
    isSavePayload,
    stampOwner: (data: string) => data,
    demoProgress: { complete: async () => true },
    preserveInitialization: async () => {
      throw new Error("receipt disk write failed");
    },
  });
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(await store.clear()).toBe(false);
    expect(await readFile(slots.primary.file, "utf8")).toBe("acknowledged progress");
  } finally {
    logged.mockRestore();
  }
});
