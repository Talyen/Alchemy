const fs = require("node:fs/promises");
const path = require("node:path");

const { steamAccountId, isSteamCloudEnabled } = require("./steam-context.cjs");
const { createSaveSlots, saveSlotFiles } = require("./save-profile.cjs");
const { createSerialOperations } = require("./serial-operations.cjs");

function stampSaveOwner(data, client) {
  return stampSaveAccount(data, steamAccountId(client));
}

function stampSaveAccount(data, steamAccount) {
  if (!steamAccount) return data;
  try {
    return JSON.stringify({ ...JSON.parse(data), steamAccountId: steamAccount });
  } catch {
    return data;
  }
}

function createDemoProgressBridge({
  directory,
  demoDirectory,
  legacyDemoDirectory,
  getSteam,
  isSavePayload,
  edition,
  platform = process.platform,
}) {
  const receiptPath = path.join(directory, "demo-initialization.json");
  const receiptCloudFile = "full-demo-initialization.json";
  const slots = (base) => Object.values(createSaveSlots(base, []));
  async function exists(file) {
    try {
      await fs.access(file);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }
  const receiptQueue = createSerialOperations();
  async function complete({ localOnly = false } = {}) {
    if (edition !== "full") return true;
    const receipt = receiptQueue.enqueue(async () => {
      try {
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(`${receiptPath}.tmp`, "initialized", "utf8");
        await fs.rename(`${receiptPath}.tmp`, receiptPath);
        return true;
      } catch {
        return false;
      }
    });
    if (!(await receipt)) return false;
    // A local wipe requires a durable local receipt; Cloud remains best effort.
    // Cloud-first deletion still requires its receipt before removing mirrors.
    try {
      const client = getSteam();
      if (isSteamCloudEnabled(client) && !(await client.cloud.writeFile(receiptCloudFile, "initialized")))
        return localOnly;
      return true;
    } catch {
      return localOnly;
    }
  }
  async function readSource() {
    const result = { initialized: edition !== "full", fullSaveExists: false, readFailed: false, candidates: [] };
    if (edition !== "full") return result;
    try {
      result.initialized = await exists(receiptPath);
      for (const file of slots(directory).flatMap((slot) => saveSlotFiles(slot, true))) {
        if (await exists(file)) result.fullSaveExists = true;
      }
      const client = getSteam();
      const account = steamAccountId(client);
      if (isSteamCloudEnabled(client)) {
        result.initialized ||= client.cloud.fileExists(receiptCloudFile);
        result.fullSaveExists ||= client.cloud.fileExists("save.json") || client.cloud.fileExists("save-recovery.json");
      }
      if (result.initialized || result.fullSaveExists) return result;
      if (!account) {
        result.readFailed = true;
        return result;
      }
      function add(data) {
        if (!isSavePayload(data)) return;
        try {
          if (JSON.parse(data).steamAccountId === account) result.candidates.push(data);
        } catch {
          /* Invalid demo candidates cannot be imported. */
        }
      }
      if (isSteamCloudEnabled(client)) {
        for (const name of ["demo-save.json", "demo-save-recovery.json"]) {
          if (client.cloud.fileExists(name)) {
            const buffer = await client.cloud.readFile(name);
            if (!buffer || buffer.length === 0) throw new Error("Demo cloud read failed");
            const data = buffer.toString("utf8");
            if (!isSavePayload(data)) throw new Error("Demo cloud save exceeds the payload limit");
            add(data);
          }
        }
      }
      if (platform === "win32") {
        for (const source of [...new Set([demoDirectory, legacyDemoDirectory].filter(Boolean))]) {
          for (const file of slots(source).flatMap((slot) => saveSlotFiles(slot))) {
            try {
              add(await fs.readFile(file, "utf8"));
            } catch (error) {
              if (error.code !== "ENOENT") throw error;
            }
          }
        }
      }
    } catch {
      result.readFailed = true;
    }
    return result;
  }
  return { readSource, complete };
}
module.exports = { createDemoProgressBridge, steamAccountId, stampSaveOwner, stampSaveAccount };
