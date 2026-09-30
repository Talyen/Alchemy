const fs = require("node:fs/promises");
const path = require("node:path");

function steamAccountId(client) {
  try {
    return client?.localplayer.getSteamId().steamId64.toString() ?? null;
  } catch {
    return null;
  }
}

function stampSaveOwner(data, client) {
  const steamAccount = steamAccountId(client);
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
  getSteam,
  isSavePayload,
  edition,
  platform = process.platform,
}) {
  const receiptPath = path.join(directory, "demo-initialization.json");
  const receiptCloudFile = "full-demo-initialization.json";
  const localFiles = ["save.json", "save-recovery.json"].flatMap((name) => [
    name,
    `${name}.tmp`,
    ...[1, 2, 3].map((i) => `${name}.bak.${i}`),
  ]);
  async function exists(file) {
    try {
      await fs.access(file);
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }
  function cloudEnabled(client) {
    return Boolean(client?.cloud.isEnabledForAccount() && client.cloud.isEnabledForApp());
  }
  async function complete({ localOnly = false } = {}) {
    if (edition !== "full") return true;
    try {
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(`${receiptPath}.tmp`, "initialized", "utf8");
      await fs.rename(`${receiptPath}.tmp`, receiptPath);
    } catch {
      return false;
    }
    // A local wipe requires a durable local receipt; Cloud remains best effort.
    // Cloud-first deletion still requires its receipt before removing mirrors.
    try {
      const client = getSteam();
      if (cloudEnabled(client) && !(await client.cloud.writeFile(receiptCloudFile, "initialized"))) return localOnly;
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
      for (const name of localFiles) if (await exists(path.join(directory, name))) result.fullSaveExists = true;
      const client = getSteam();
      const account = steamAccountId(client);
      if (cloudEnabled(client)) {
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
      if (cloudEnabled(client)) {
        for (const name of ["demo-save.json", "demo-save-recovery.json"]) {
          if (client.cloud.fileExists(name)) {
            const buffer = await client.cloud.readFile(name);
            if (!buffer) throw new Error("Demo cloud read failed");
            add(buffer.toString("utf8"));
          }
        }
      }
      if (platform === "win32") {
        for (const name of localFiles.filter((name) => !name.endsWith(".tmp"))) {
          try {
            add(await fs.readFile(path.join(demoDirectory, name), "utf8"));
          } catch (error) {
            if (error.code !== "ENOENT") throw error;
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
module.exports = { createDemoProgressBridge, steamAccountId, stampSaveOwner };
