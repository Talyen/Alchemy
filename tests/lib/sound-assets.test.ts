import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allRegisteredSoundFiles } from "@/lib/sound-registry";
import {
  curatedSoundFiles,
  generatedSoundAssets,
  validateSoundAssetRegistry,
} from "../../scripts/assets/sound-assets.mjs";

const soundsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/sounds");
const rawSoundsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../Raw Assets/Sound Effects");
const declaredSounds = new Set([...generatedSoundAssets.map(({ target }) => target), ...curatedSoundFiles]);

describe("registered SFX assets", () => {
  it("keeps generated and curated ownership structurally valid", async () => {
    await expect(validateSoundAssetRegistry({ sourceDir: rawSoundsDir })).resolves.toBeUndefined();
  });

  it("declares every runtime sound and keeps every declared OGG on disk", () => {
    const undeclared = allRegisteredSoundFiles().filter((file) => !declaredSounds.has(file));
    const missing = [...declaredSounds].filter((file) => !existsSync(path.join(soundsDir, file)));
    expect(undeclared).toEqual([]);
    expect(missing).toEqual([]);
  });

  it("owns every OGG in public/sounds as generated or curated", () => {
    const onDisk = readdirSync(soundsDir).filter((file) => file.endsWith(".ogg"));
    expect(onDisk.filter((file) => !declaredSounds.has(file))).toEqual([]);
  });

  it("every declared OGG has an MP3 sibling for Safari", () => {
    const missingMp3 = [...declaredSounds]
      .map((file) => file.replace(/\.ogg$/i, ".mp3"))
      .filter((file) => !existsSync(path.join(soundsDir, file)));
    expect(missingMp3).toEqual([]);
  });
});
