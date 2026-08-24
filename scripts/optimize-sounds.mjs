import { execFile } from "node:child_process";
import { mkdir, copyFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// ffmpeg-static downloads a platform-specific ffmpeg binary so we don't rely
// on system installation. We use it to normalize volume and convert WAVs to OGG.
import ffmpegPath from "ffmpeg-static";

import {
  isOutputFresh,
  processManifestEntries,
  resolveSourceHash,
  writeManifestIfChanged,
} from "./lib/asset-manifest-cache.mjs";
import { formatProcessError, runAudioScript } from "./lib/audio-optimizer.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { mapPool } from "./lib/map-pool.mjs";

const execFileAsync = promisify(execFile);

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Assets", "Sound Effects");
const outputDir = path.join(rootDir, "public", "sounds");
const manifestPath = path.join(outputDir, ".asset-hashes.json");

/** Bump when ffmpeg args, hash inputs, or manifest entry shape change. */
const SCHEMA_VERSION = 2;
const TRANSFORM_CONCURRENCY = 6;

const LOUDNORM_FILTER = "loudnorm=I=-16:TP=-1.5:LRA=11";
const VORBIS_QUALITY = "4";
const MP3_FALLBACK_SETTINGS = { codec: "libmp3lame", quality: "4", stripVideo: true };
const SOUND_ENTRY_OWNERS = Object.freeze({ generated: "generated", curated: "curated" });

// Each entry maps a raw asset (relative to "Raw Assets/Sound Effects/") to an
// output name in public/sounds/. The script converts WAV → OGG and copies OGG
// files straight through. Output names are kebab-cased for clean URLs.
//
// public/sounds is intentionally PARTIALLY managed: it also holds manually-curated
// .ogg files with no raw source in "Raw Assets/Sound Effects" (e.g. purchased SFX
// packs referenced from src/lib/sound-registry.ts). Do not add orphan cleanup here;
// a blanket sweep would delete those files. Compare with optimize-music.mjs, whose
// output directory is fully managed.
const sounds = [
  // ── Cards ──
  { source: "Attacks and Combat/Sword Attacks Hits and Blocks/Sword Attack 1.ogg", target: "sword-attack-1.ogg" },
  { source: "Attacks and Combat/Sword Attacks Hits and Blocks/Sword Attack 3.ogg", target: "sword-attack-3.ogg" },
  { source: "Attacks and Combat/Sword Attacks Hits and Blocks/Sword Blocked 1.ogg", target: "sword-blocked-1.ogg" },
  { source: "Spells/Rock Meteor Swarm 1.ogg", target: "rock-meteor-swarm-1.ogg" },
  { source: "Musical Effects/harpsichord_mystery.wav", target: "harpsichord-mystery.ogg" },
  { source: "Spells/Fireball 1.ogg", target: "fireball-1.ogg" },
  { source: "Spells/Ice Throw 1.ogg", target: "ice-throw-1.ogg" },

  // ── Enemy attacks ──
  { source: "Torch/Torch Attack Strike 1.ogg", target: "torch-attack-strike-1.ogg" },

  // ── Battle events ──
  {
    source: "Attacks and Combat/Sword Attacks Hits and Blocks/Sword Impact Hit 1.ogg",
    target: "sword-impact-hit-1.ogg",
  },
  { source: "Weapons/sword_slice.wav", target: "sword-slice.ogg" },
  { source: "Attacks and Combat/Sword Attacks Hits and Blocks/Sword Blocked 2.ogg", target: "sword-blocked-2.ogg" },
  { source: "Weapons/sword_clash.wav", target: "sword-clash.ogg" },
  { source: "Spells/Ice Freeze 1.ogg", target: "ice-freeze-1.ogg" },
  { source: "Torch/Torch Impact 1.ogg", target: "torch-impact-1.ogg" },
  { source: "Card and Board/card_fan.wav", target: "card-fan.ogg" },
  { source: "Card and Board/card_draw_1.wav", target: "card-draw-1.ogg" },
  { source: "Card and Board/card_draw_2.wav", target: "card-draw-2.ogg" },
  { source: "UI/toggle_off.wav", target: "toggle-off.ogg" },

  // ── UI ──
  { source: "UI/metal button 4.wav", target: "metal-button-4.ogg" },
  { source: "Card and Board/card_draw_3.wav", target: "card-draw-3.ogg" },
  { source: "UI/toggle_on.wav", target: "toggle-on.ogg" },
  { source: "UI/033_Denied_03.wav", target: "denied-03.ogg" },
  { source: "Environment/fire_lighting.wav", target: "fire-lighting.ogg" },
  { source: "Musical Effects/harpsichord_level_complete.wav", target: "harpsichord-level-complete.ogg" },
  { source: "Items/page_turn.wav", target: "page-turn.ogg" },
  { source: "Materials/paper_move.wav", target: "paper-move.ogg" },

  // ── Game flow stingers ──
  { source: "Musical Effects/harpsichord_defeated.wav", target: "harpsichord-defeated.ogg" },
  { source: "Musical Effects/horror_sting.wav", target: "horror-sting.ogg" },

  // ── Replacement / new sounds ──
  { source: "Musical Effects/music_box_mystery.wav", target: "music-box-mystery.ogg" },
  { source: "Environment/ice_in_water.wav", target: "ice-in-water.ogg" },
  { source: "Musical Effects/music_box_chime_positive.wav", target: "music-box-chime-positive.ogg" },

  // ── New requested sounds ──
  { source: "Spells/MAGAngl_BUFF-Buff Pickup_HY_PC-002.wav", target: "buff-pickup.ogg" },
  { source: "Spells/MAGAngl_BUFF-Buff Pickup_HY_PC-001.wav", target: "buff-pickup-1.ogg" },
  { source: "Attacks and Combat/FGHTImpt_MELEE-Swish Hit_HY_PC-001.wav", target: "swish-hit.ogg" },
  { source: "Attacks and Combat/FGHTImpt_HIT-Strong Punch_HY_PC-005.wav", target: "strong-punch.ogg" },
  { source: "Spells/MAGSpel_CAST-Energy Noise_HY_PC-001.wav", target: "energy-noise.ogg" },
  { source: "Attacks and Combat/FGHTImpt_MELEE-Gut Kick_HY_PC-001.wav", target: "gut-kick.ogg" },
  { source: "Spells/MAGAngl_BUFF-Bonus Regen Rate_HY_PC-006.wav", target: "bonus-regen-rate.ogg" },
  {
    source: "Attacks and Combat/Sword Attacks Hits and Blocks/Sword Impact Hit 2.ogg",
    target: "sword-impact-hit-2.ogg",
  },

  // ── Salvage ──
  { source: "Chopping and Mining/mine 2.ogg", target: "mine-2.ogg" },
];

function soundTransformSettings(sourceExt) {
  if (sourceExt === ".ogg") {
    return { mode: "copy" };
  }
  return {
    mode: "convert",
    codec: "libvorbis",
    quality: VORBIS_QUALITY,
    af: LOUDNORM_FILTER,
    stripVideo: true,
  };
}

async function optimizeSound({ source, target }, storedEntry) {
  const sourcePath = path.join(sourceDir, source);
  const outputPath = path.join(outputDir, target);
  const ext = path.extname(source).toLowerCase();
  const settings = soundTransformSettings(ext);
  const sourceEntry = await resolveSourceHash(sourcePath, settings, SCHEMA_VERSION, storedEntry);
  const isFresh = await isOutputFresh(outputPath, storedEntry, sourceEntry.hash);
  if (isFresh) {
    return { message: `${target} already up to date`, entry: sourceEntry };
  }

  if (settings.mode === "copy") {
    // Already OGG — copy through unchanged.
    await copyFile(sourcePath, outputPath);
    return { message: `${target} copied`, entry: sourceEntry };
  }

  // Convert WAV (or anything else) to OGG Vorbis with gentle loudness normalization
  // so UI pops aren't deafening next to musical stingers. -q 4 is the sweet spot
  // between quality (~128kbps) and file size for SFX.
  await execFileAsync(ffmpegPath, [
    "-y",
    "-i",
    sourcePath,
    "-af",
    LOUDNORM_FILTER,
    "-c:a",
    "libvorbis",
    "-q:a",
    VORBIS_QUALITY,
    "-vn",
    outputPath,
  ]);

  return { message: `${target} converted`, entry: sourceEntry };
}

export async function optimizeSounds() {
  if (!ffmpegPath) {
    console.error("ffmpeg-static binary not found. Run: npm install");
    return { ok: false };
  }

  await mkdir(outputDir, { recursive: true });

  const { previousManifest, nextManifest, results, failed } = await processManifestEntries({
    entries: sounds,
    manifestPath,
    concurrency: TRANSFORM_CONCURRENCY,
    processEntry: optimizeSound,
    handleError: (sound, error) => formatProcessError(sound.target, error),
  });

  console.log(`Processed ${results.length} sounds.`);
  const managedOggs = new Set(sounds.map(({ target }) => target));
  const generatedEntries = Object.fromEntries(
    Object.entries(nextManifest).map(([name, entry]) => [name, { ...entry, owner: SOUND_ENTRY_OWNERS.generated }]),
  );
  const { mp3Entries, curatedOggEntries } = await ensureMp3Fallbacks(previousManifest, managedOggs);
  await writeManifestIfChanged(manifestPath, { ...generatedEntries, ...curatedOggEntries, ...mp3Entries });
  return { ok: !failed };
}

async function ensureMp3Fallbacks(previousManifest, managedOggs) {
  const files = await readdir(outputDir);
  const oggs = files.filter((file) => file.endsWith(".ogg"));
  /** @type {Record<string, import("./lib/asset-manifest-cache.mjs").ManifestEntry>} */
  const mp3Entries = {};
  const curatedOggEntries = {};
  let converted = 0;
  await mapPool(oggs, TRANSFORM_CONCURRENCY, async (ogg) => {
    const oggPath = path.join(outputDir, ogg);
    const mp3Name = ogg.replace(/\.ogg$/i, ".mp3");
    const mp3Path = path.join(outputDir, mp3Name);
    const stored = previousManifest[mp3Name];
    const sourceEntry = await resolveSourceHash(oggPath, MP3_FALLBACK_SETTINGS, SCHEMA_VERSION, stored);
    const fingerprint =
      stored && stored.hash === sourceEntry.hash && Number.isFinite(stored.mtimeMs) && Number.isFinite(stored.size)
        ? stored
        : sourceEntry;
    mp3Entries[mp3Name] = {
      ...fingerprint,
      owner: managedOggs.has(ogg) ? SOUND_ENTRY_OWNERS.generated : SOUND_ENTRY_OWNERS.curated,
    };
    if (!managedOggs.has(ogg)) {
      const storedOgg = previousManifest[ogg];
      const oggEntry = await resolveSourceHash(oggPath, { mode: "curated" }, SCHEMA_VERSION, storedOgg);
      // Keep the stored fingerprint when content is unchanged so manifests stay stable across machines.
      const fingerprint =
        storedOgg && storedOgg.hash === oggEntry.hash && Number.isFinite(storedOgg.mtimeMs) ? storedOgg : oggEntry;
      curatedOggEntries[ogg] = { ...fingerprint, owner: SOUND_ENTRY_OWNERS.curated };
    }

    const mp3Exists = await stat(mp3Path)
      .then(() => true)
      .catch(() => false);
    // Existing MP3s stay committed across machines; only encode when missing or the OGG hash changed.
    if (mp3Exists && (!stored || stored.hash === sourceEntry.hash)) return;

    await execFileAsync(ffmpegPath, ["-y", "-i", oggPath, "-c:a", "libmp3lame", "-q:a", "4", "-vn", mp3Path]);
    converted += 1;
  });
  if (converted > 0) console.log(`Wrote ${converted} MP3 SFX fallbacks for Safari.`);
  return { mp3Entries, curatedOggEntries };
}

if (isMainModule(import.meta.url)) {
  runAudioScript("Sound optimization", optimizeSounds);
}
