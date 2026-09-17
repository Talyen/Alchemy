import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { allRegisteredMusicFiles } from "@/lib/audio/music";
import { allRegisteredSoundFiles } from "@/lib/audio/sound-registry";
import {
  curatedSoundFiles,
  generatedSoundAssets,
  validateSoundAssetRegistry,
} from "../../../scripts/assets/sound-assets.mjs";
import { validateMusicRegistry } from "../../../scripts/assets/music-assets.mjs";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const soundsDir = path.join(rootDir, "public/sounds");
const rawSoundsDir = path.join(rootDir, "Raw Assets/Sound Effects");
const musicDir = path.join(rootDir, "public/Music");

const hasRawSounds = existsSync(rawSoundsDir);
const declaredSounds = new Set([...generatedSoundAssets.map(({ target }) => target), ...curatedSoundFiles]);

describe("registered music assets", () => {
  it("keeps every registered track on disk", () => {
    const missing = allRegisteredMusicFiles().filter((file) => !existsSync(path.join(musicDir, file)));
    expect(missing).toEqual([]);
  });

  it("registers every music file on disk", () => {
    const registered = new Set(allRegisteredMusicFiles());
    const onDisk = readdirSync(musicDir).filter((file) => !file.startsWith("."));
    expect(onDisk.filter((file) => !registered.has(file))).toEqual([]);
  });

  it("keeps the music filename registry valid (no duplicates or unsupported extensions)", async () => {
    const onDisk = readdirSync(musicDir).filter((file) => !file.startsWith("."));
    await expect(validateMusicRegistry(onDisk)).resolves.toEqual(onDisk);
  });

  it("owns every prepared music output as a registered track", () => {
    const manifestPath = path.join(musicDir, ".asset-hashes.json");
    if (!existsSync(manifestPath)) return;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const registered = new Set(allRegisteredMusicFiles());
    expect(Object.keys(manifest).filter((file) => !registered.has(file))).toEqual([]);
  });
});

describe("registered SFX assets", () => {
  it("keeps generated and curated ownership structurally valid", async () => {
    await expect(validateSoundAssetRegistry(hasRawSounds ? { sourceDir: rawSoundsDir } : {})).resolves.toBeUndefined();
  });

  it("declares every runtime sound and keeps every declared OGG on disk", () => {
    const undeclared = allRegisteredSoundFiles().filter((file) => !declaredSounds.has(file));
    const missing = [...declaredSounds].filter((file) => !existsSync(path.join(soundsDir, file)));
    expect(undeclared).toEqual([]);
    expect(missing).toEqual([]);
  });

  it("references every declared sound from the runtime registry", () => {
    const referenced = new Set(allRegisteredSoundFiles());
    const orphaned = [...declaredSounds].filter((file) => !referenced.has(file));
    expect(orphaned).toEqual([]);
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
