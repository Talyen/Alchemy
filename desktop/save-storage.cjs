const fs = require("node:fs/promises");
const path = require("node:path");
const { setImmediate } = require("node:timers");

/** Native profile storage outlives every renderer and its session queue. */
function createDesktopSaveStorage({
  slots,
  demoProgress,
  isSavePayload,
  stampOwner,
  preserveInitialization = async () => {},
  filesystem = fs,
}) {
  let lane = Promise.resolve();
  let closed = false;
  function enqueue(operation) {
    const result = lane.then(operation);
    // Reject only this caller. Later operations still own their place.
    lane = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  function resolveSlot(slot) {
    if (slot === undefined) return slots.primary;
    if (slot === "recovery") return slots.recovery;
    throw new Error("Invalid save slot");
  }
  async function read(slot) {
    const paths = resolveSlot(slot);
    const candidates = [];
    let localReadFailed = false;
    for (const filePath of [paths.file, ...paths.backups]) {
      try {
        const data = await filesystem.readFile(filePath, "utf8");
        if (isSavePayload(data)) candidates.push(data);
        else localReadFailed = true;
      } catch (error) {
        if (error?.code === "ENOENT") continue;
        console.error(`[save] Error reading save candidate ${filePath}:`, error);
        localReadFailed = true;
      }
    }
    return { candidates, localReadFailed };
  }

  function write(input, slot) {
    if (closed) return Promise.resolve(false);
    if (!isSavePayload(input)) return Promise.resolve(false);
    const data = stampOwner(input);
    if (!isSavePayload(data)) return Promise.resolve(false);
    const paths = resolveSlot(slot);
    return enqueue(async () => {
      try {
        await filesystem.mkdir(path.dirname(paths.file), { recursive: true });
        const handle = await filesystem.open(paths.tmp, "w");
        try {
          await handle.writeFile(data, "utf8");
          await handle.datasync();
        } finally {
          await handle.close();
        }
        for (let index = paths.backups.length - 1; index >= 0; index -= 1) {
          const to = paths.backups[index];
          const from = index === 0 ? paths.file : paths.backups[index - 1];
          try {
            await filesystem.access(from, fs.constants.F_OK);
          } catch (error) {
            if (error?.code === "ENOENT") continue;
            throw error;
          }
          if (index === paths.backups.length - 1) {
            await filesystem.unlink(to).catch((error) => {
              if (error?.code !== "ENOENT") throw error;
            });
          }
          await filesystem.rename(from, to);
        }
        await filesystem.rename(paths.tmp, paths.file);
        return true;
      } catch (error) {
        await filesystem.unlink(paths.tmp).catch((cleanupError) => {
          if (cleanupError?.code !== "ENOENT") console.error("[save] Error cleaning up temp save file:", cleanupError);
        });
        console.error("[save] Error writing save file:", error);
        return false;
      }
    });
  }
  async function clear() {
    try {
      // A failed startup migration must not restore its old source after a later clear.
      await preserveInitialization();
      if (!(await demoProgress.complete({ localOnly: true }))) return false;
      // Wipe both rings so an older recovery snapshot cannot restore a cleared profile.
      for (const paths of Object.values(slots)) {
        for (const filePath of [paths.file, paths.tmp, ...paths.backups]) {
          try {
            await filesystem.unlink(filePath);
          } catch (error) {
            if (error?.code !== "ENOENT") throw error;
          }
        }
      }
      return true;
    } catch (error) {
      console.error("[save] Error clearing save files:", error);
      return false;
    }
  }
  return {
    read: (slot) => enqueue(() => read(slot)),
    write,
    clear: () => (closed ? Promise.resolve(false) : enqueue(clear)),
    readDemoImportSource: () => enqueue(() => demoProgress.readSource()),
    completeDemoInitialization: () => (closed ? Promise.resolve(false) : enqueue(() => demoProgress.complete())),
    close() {
      closed = true;
      return lane;
    },
  };
}
function registerSaveShutdown(app, store) {
  let ready = false;
  let draining;
  // Renderer beforeunload handlers submit their final saves while windows close.
  // Keep admission open until will-quit, then drain before the process exits.
  app.on("will-quit", (event) => {
    if (ready) return;
    event.preventDefault();
    draining ??= store.close().then(() => {
      // Electron resets its native quitting flag after will-quit returns.
      // An already-resolved drain must not retry inside that event's microtasks.
      setImmediate(() => {
        ready = true;
        app.quit();
      });
    });
  });
}
module.exports = { createDesktopSaveStorage, registerSaveShutdown };
