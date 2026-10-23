const fs = require("node:fs/promises");
const path = require("node:path");

function saveProfileDirectory(base, account, isolated = false) {
  if (isolated) return base;
  if (account !== null && !/^[1-9]\d*$/u.test(account)) throw new Error("Invalid Steam save account");
  return path.join(base, account === null ? "offline" : "steam", ...(account === null ? [] : [account]));
}

function createSaveSlots(directory, cloudFiles) {
  return Object.fromEntries(
    ["save.json", "save-recovery.json"].map((name, index) => [
      index === 0 ? "primary" : "recovery",
      {
        name: cloudFiles[index],
        file: path.join(directory, name),
        tmp: path.join(directory, `${name}.tmp`),
        backups: [1, 2, 3].map((i) => path.join(directory, `${name}.bak.${i}`)),
      },
    ]),
  );
}

async function retainLegacyMigrationReceipt(directory) {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "legacy-migration.json"), "migrated", { flag: "wx" }).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
}

// Copy only attributable legacy candidates, leaving originals and current saves intact.
// The receipt survives Clear Save Data so a cleared profile cannot reimport old files.
async function migrateLegacySaveProfile({ base, directory, account, isSavePayload }) {
  if (base === directory) return;
  const receipt = path.join(directory, "legacy-migration.json");
  try {
    await fs.access(receipt);
    return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fs.mkdir(directory, { recursive: true });
  const currentFiles = Object.values(createSaveSlots(directory, [])).flatMap((slot) => [
    slot.file,
    slot.tmp,
    ...slot.backups,
  ]);
  const established = (
    await Promise.all(
      currentFiles.map((file) =>
        fs.access(file).then(
          () => true,
          (error) => {
            if (error.code === "ENOENT") return false;
            throw error;
          },
        ),
      ),
    )
  ).some(Boolean);
  if (!established)
    for (const slot of Object.values(createSaveSlots(base, []))) {
      for (const source of [slot.file, ...slot.backups]) {
        let data;
        try {
          data = await fs.readFile(source, "utf8");
        } catch (error) {
          if (error.code === "ENOENT") continue;
          throw error;
        }
        if (!isSavePayload(data)) continue;
        try {
          if ((JSON.parse(data).steamAccountId ?? null) !== account) continue;
        } catch {
          continue;
        }
        try {
          await fs.writeFile(path.join(directory, path.basename(source)), data, { flag: "wx" });
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
      }
    }
  await retainLegacyMigrationReceipt(directory);
}

module.exports = { saveProfileDirectory, createSaveSlots, migrateLegacySaveProfile, retainLegacyMigrationReceipt };
