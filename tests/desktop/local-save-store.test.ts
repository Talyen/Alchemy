import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import * as io from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const { createLocalSaveStore, registerSaveShutdown } = require("../../desktop/local-save-store.cjs");
const { isSavePayload, MAX_SAVE_PAYLOAD_BYTES } = require("../../desktop/security.cjs");
const { stampSaveOwner } = require("../../desktop/demo-progress.cjs");
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => io.rm(directory, { recursive: true, force: true })));
});
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function fixture(holdWrite = false) {
  const directory = await io.mkdtemp(path.join(tmpdir(), "alchemy-disk-"));
  directories.push(directory);
  const slots = Object.fromEntries(
    ["primary", "recovery"].map((slot) => {
      const file = path.join(directory, `${slot}.json`);
      return [slot, { file, tmp: `${file}.tmp`, backups: [1, 2, 3].map((i) => `${file}.bak.${i}`) }];
    }),
  );
  const entered = deferred();
  const release = deferred();
  const beforeClear = vi.fn(async () => true);
  const readFile = vi.fn(io.readFile);
  const store = createLocalSaveStore({
    slots,
    isSavePayload,
    stampSave: (data: string) => data,
    beforeClear,
    io: {
      ...io,
      readFile,
      rename: async (from: string, to: string) => {
        if (holdWrite && from === slots.primary.tmp) {
          entered.resolve();
          await release.promise;
        }
        return io.rename(from, to);
      },
    },
  });
  return { directory, slots, store, entered, release, beforeClear, readFile };
}
it("Clear Save waits for an accepted native write and removes both backup rings", async () => {
  const f = await fixture(true);
  await io.writeFile(f.slots.primary.file, "old");
  await io.writeFile(f.slots.recovery.backups[0], "recovery");
  const writing = f.store.write("new");
  await f.entered.promise;
  const clearing = f.store.clear();
  await Promise.resolve();
  const clearStartedEarly = f.beforeClear.mock.calls.length > 0;
  f.release.resolve();
  expect(await writing).toBe(true);
  expect(await clearing).toBe(true);
  expect(clearStartedEarly).toBe(false);
  expect(await io.readdir(f.directory)).toEqual([]);
});
it("protects oversized local candidates while retaining a readable backup", async () => {
  const f = await fixture();
  await io.writeFile(f.slots.primary.file, "x".repeat(MAX_SAVE_PAYLOAD_BYTES + 1));
  await io.writeFile(f.slots.primary.backups[0], "backup");
  expect(await f.store.read()).toEqual({ candidates: ["backup"], localReadFailed: true });
});
it("rejects an owner-stamped save that would exceed the readable payload limit", async () => {
  const f = await fixture();
  const data = JSON.stringify({ padding: "x".repeat(MAX_SAVE_PAYLOAD_BYTES - 14) });
  expect(isSavePayload(data)).toBe(true);
  const store = createLocalSaveStore({
    slots: f.slots,
    isSavePayload,
    beforeClear: f.beforeClear,
    stampSave: (value: string) => stampSaveOwner(value, { localplayer: { getSteamId: () => ({ steamId64: 123n }) } }),
  });
  expect(await store.write(data)).toBe(false);
  expect(await io.readdir(f.directory)).toEqual([]);
});
it("shutdown drains accepted writes, rejects late writes, and quits exactly once", async () => {
  const f = await fixture(true);
  const app = new EventEmitter() as EventEmitter & { quit: ReturnType<typeof vi.fn> };
  let exits = 0;
  app.quit = vi.fn(() => {
    const event = { preventDefault: vi.fn() };
    app.emit("before-quit", event);
    if (!event.preventDefault.mock.calls.length) exits++;
  });
  registerSaveShutdown(app, f.store);
  const writing = f.store.write("latest");
  await f.entered.promise;
  app.quit();
  app.quit();
  const exitsDuringWrite = exits;
  const lateWrite = f.store.write("too late");
  f.release.resolve();
  await writing;
  await f.store.close();
  await Promise.resolve();
  expect(exitsDuringWrite).toBe(0);
  expect(await lateWrite).toBe(false);
  expect(exits).toBe(1);
  expect(await io.readFile(f.slots.primary.file, "utf8")).toBe("latest");
});
it("a renderer reload reads the latest accepted native write after it finishes", async () => {
  const f = await fixture(true);
  await io.writeFile(f.slots.primary.file, "old");
  const writing = f.store.write("latest");
  await f.entered.promise;
  const reading = f.store.read();
  await Promise.resolve();
  const readsDuringWrite = f.readFile.mock.calls.length;
  f.release.resolve();
  await writing;
  expect(await reading).toEqual({ candidates: ["latest", "old"], localReadFailed: false });
  expect(readsDuringWrite).toBe(0);
});
