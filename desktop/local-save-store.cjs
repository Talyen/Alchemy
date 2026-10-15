const fs = require("node:fs");
const path = require("node:path");

function createLocalSaveStore({ slots, isSavePayload, stampSave, beforeClear, io = fs.promises }) {
  let queue = Promise.resolve();
  let closed = false;
  function resolveSlot(slot) {
    if (slot === undefined) return slots.primary;
    if (slot === "recovery") return slots.recovery;
    throw new Error("Invalid save slot");
  }
  function enqueue(operation) {
    const task = queue.then(operation);
    queue = task.catch(() => {});
    return task;
  }
  async function readSlot(slot) {
    const paths = resolveSlot(slot);
    const candidates = [];
    let localReadFailed = false;
    for (const filePath of [paths.file, ...paths.backups]) {
      try {
        const data = await io.readFile(filePath, "utf8");
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

  function read(slot) {
    return enqueue(() => readSlot(slot));
  }
  function write(data, slot) {
    if (closed) return Promise.resolve(false);
    const paths = resolveSlot(slot);
    if (!isSavePayload(data)) return Promise.resolve(false);
    data = stampSave(data);
    if (!isSavePayload(data)) return Promise.resolve(false);
    return enqueue(async () => {
      try {
        await io.mkdir(path.dirname(paths.file), { recursive: true });
        const handle = await io.open(paths.tmp, "w");
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
            await io.access(from, fs.constants.F_OK);
          } catch (error) {
            if (error?.code === "ENOENT") continue;
            throw error;
          }
          if (index === paths.backups.length - 1) {
            await io.unlink(to).catch((error) => {
              if (error?.code !== "ENOENT") throw error;
            });
          }
          await io.rename(from, to);
        }
        await io.rename(paths.tmp, paths.file);
        return true;
      } catch (error) {
        await io.unlink(paths.tmp).catch((cleanupError) => {
          if (cleanupError?.code !== "ENOENT") console.error("[save] Error cleaning up temp save file:", cleanupError);
        });
        console.error("[save] Error writing save file:", error);
        return false;
      }
    });
  }
  function clear() {
    if (closed) return Promise.resolve(false);
    return enqueue(async () => {
      if (!(await beforeClear())) return false;
      // Wipe both rings so an older recovery snapshot cannot restore a cleared profile.
      try {
        for (const paths of Object.values(slots)) {
          for (const filePath of [paths.file, paths.tmp, ...paths.backups]) {
            try {
              await io.unlink(filePath);
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
    });
  }
  function close() {
    closed = true;
    return queue;
  }
  return { read, write, clear, close };
}

function registerSaveShutdown(app, store) {
  let ready = false;
  let draining;
  app.on("before-quit", (event) => {
    if (ready) return;
    event.preventDefault();
    draining ??= store.close().then(() => {
      ready = true;
      app.quit();
    });
  });
}
module.exports = { createLocalSaveStore, registerSaveShutdown };
