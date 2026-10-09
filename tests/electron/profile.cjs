const { app, ipcMain } = require("electron");

const profile = process.env.ALCHEMY_ELECTRON_TEST_PROFILE;
if (!profile) throw new Error("Electron tests require an isolated profile");
// Run before desktop/main.cjs captures its save paths or creates a browser session.
app.setPath("userData", profile);
app.setPath("sessionData", profile);

// Fault control exists only in this test preload. It never ships with the game.
const fs = require("node:fs");
const path = require("node:path");
const control = path.join(profile, "save-barrier.json");
const reached = path.join(profile, "save-barrier.reached");
const release = path.join(profile, "save-barrier.release");
async function saveBarrier(stage) {
  if (!fs.existsSync(control)) return;
  const selected = JSON.parse(fs.readFileSync(control, "utf8"));
  if (selected.stage !== stage) return;
  fs.unlinkSync(control); // One resolved action, never an unrelated later save.
  await new Promise((resolve) => {
    const watcher = fs.watch(profile, (_event, filename) => {
      if (filename === path.basename(release) && fs.existsSync(release)) {
        watcher.close();
        fs.unlinkSync(release);
        resolve();
      }
    });
    fs.writeFileSync(reached, stage);
  });
}
const open = fs.promises.open.bind(fs.promises);
fs.promises.open = async (file, ...args) => {
  const handle = await open(file, ...args);
  if (path.dirname(String(file)) !== profile || !/^save(?:-recovery)?\.json\.tmp$/.test(path.basename(String(file))))
    return handle;
  const write = handle.writeFile.bind(handle);
  handle.writeFile = async (...writeArgs) => {
    await saveBarrier("before-write");
    const result = await write(...writeArgs);
    await saveBarrier("after-temp-write");
    return result;
  };
  const sync = handle.datasync.bind(handle);
  handle.datasync = async () => {
    const result = await sync();
    await saveBarrier("after-temp-sync");
    return result;
  };
  return handle;
};
const rename = fs.promises.rename.bind(fs.promises);
fs.promises.rename = async (from, to) => {
  const result = await rename(from, to);
  if (path.dirname(String(from)) === profile) {
    if (/^save(?:-recovery)?\.json$/.test(path.basename(String(from)))) await saveBarrier("after-backup-rotation");
    if (/^save(?:-recovery)?\.json\.tmp$/.test(path.basename(String(from)))) await saveBarrier("after-replace");
  }
  return result;
};

const registerHandler = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) =>
  registerHandler(channel, async (...args) => {
    if (channel === "alchemy:write-save") await saveBarrier("before-submit");
    return listener(...args);
  });
