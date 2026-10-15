import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import * as io from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const { createDesktopSaveStorage, registerSaveShutdown } = require("../../desktop/save-storage.cjs");
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
  const store = createDesktopSaveStorage({
    slots,
    isSavePayload,
    stampOwner: (data: string) => data,
    demoProgress: { complete: beforeClear },
    filesystem: {
      ...io,
      rename: async (from: string, to: string) => {
        if (holdWrite && from === slots.primary.tmp) {
          entered.resolve();
          await release.promise;
        }
        return io.rename(from, to);
      },
    },
  });
  return { directory, slots, store, entered, release, beforeClear };
}
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
  const store = createDesktopSaveStorage({
    slots: f.slots,
    isSavePayload,
    demoProgress: { complete: f.beforeClear },
    stampOwner: (value: string) => stampSaveOwner(value, { localplayer: { getSteamId: () => ({ steamId64: 123n }) } }),
  });
  expect(await store.write(data)).toBe(false);
  expect(await io.readdir(f.directory)).toEqual([]);
});
it("shutdown accepts the renderer's unload save, drains writes, and quits exactly once", async () => {
  const f = await fixture(true);
  const app = new EventEmitter() as EventEmitter & { quit: ReturnType<typeof vi.fn> };
  let exits = 0;
  let windowOpen = true;
  let unloadWrite: Promise<boolean> | undefined;
  app.quit = vi.fn(() => {
    const before = { preventDefault: vi.fn() };
    app.emit("before-quit", before);
    if (before.preventDefault.mock.calls.length) return;
    if (windowOpen) {
      // Electron closes windows (and runs renderer beforeunload) between these events.
      windowOpen = false;
      unloadWrite = f.store.write("unload progress");
    }
    const will = { preventDefault: vi.fn() };
    app.emit("will-quit", will);
    if (!will.preventDefault.mock.calls.length) exits++;
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
  expect(await unloadWrite).toBe(true);
  expect(await lateWrite).toBe(false);
  expect(exits).toBe(1);
  expect(await io.readFile(f.slots.primary.file, "utf8")).toBe("unload progress");
});
