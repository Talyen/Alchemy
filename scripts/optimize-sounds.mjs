import { execFile } from "node:child_process";
import { mkdir, stat, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

// ffmpeg-static downloads a platform-specific ffmpeg binary so we don't rely
// on system installation. We use it to normalize volume and convert WAVs to OGG.
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), "..");
const sourceDir = path.join(rootDir, "Raw Assets", "Sound Effects");
const outputDir = path.join(rootDir, "public", "sounds");

// Each entry maps a raw asset (relative to "Raw Assets/Sound Effects/") to an
// output name in public/sounds/. The script converts WAV → OGG and copies OGG
// files straight through. Output names are kebab-cased for clean URLs.
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
  // cough-double source no longer present in raw assets; existing output preserved in public/sounds.
  // { source: "Human/cough_double.wav", target: "cough-double.ogg" },

  // ── Battle events ──
  {
    source: "Attacks and Combat/Sword Attacks Hits and Blocks/Sword Impact Hit 1.ogg",
    target: "sword-impact-hit-1.ogg",
  },
  { source: "Attacks and Combat/Sword Attacks Hits and Blocks/Sword Blocked 2.ogg", target: "sword-blocked-2.ogg" },
  { source: "Weapons/sword_clash.wav", target: "sword-clash.ogg" },
  { source: "Spells/Ice Freeze 1.ogg", target: "ice-freeze-1.ogg" },
  { source: "Torch/Torch Impact 1.ogg", target: "torch-impact-1.ogg" },
  { source: "Card and Board/card_fan.wav", target: "card-fan.ogg" },
  { source: "Card and Board/card_draw_1.wav", target: "card-draw-1.ogg" },
  { source: "Card and Board/card_draw_2.wav", target: "card-draw-2.ogg" },
  { source: "UI/toggle_off.wav", target: "toggle-off.ogg" },

  // ── UI ──
  { source: "UI/Minimalist3.ogg", target: "button-hover-3.ogg" },
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

async function fileIsFresh(sourcePath, outputPath) {
  try {
    const [sourceInfo, outputInfo] = await Promise.all([stat(sourcePath), stat(outputPath)]);
    return outputInfo.mtimeMs >= sourceInfo.mtimeMs;
  } catch {
    return false;
  }
}

async function optimizeSound({ source, target }) {
  const sourcePath = path.join(sourceDir, source);
  const outputPath = path.join(outputDir, target);

  const isFresh = await fileIsFresh(sourcePath, outputPath);
  if (isFresh) {
    return `${target} already up to date`;
  }

  const ext = path.extname(source).toLowerCase();

  if (ext === ".ogg") {
    // Already OGG — copy through unchanged.
    await copyFile(sourcePath, outputPath);
    return `${target} copied`;
  }

  // Convert WAV (or anything else) to OGG Vorbis with gentle loudness normalization
  // so UI pops aren't deafening next to musical stingers. -q 4 is the sweet spot
  // between quality (~128kbps) and file size for SFX.
  await execFileAsync(ffmpegPath, [
    "-y",
    "-i",
    sourcePath,
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:a",
    "libvorbis",
    "-q:a",
    "4",
    "-vn",
    outputPath,
  ]);

  return `${target} converted`;
}

async function main() {
  if (!ffmpegPath) {
    console.error("ffmpeg-static binary not found. Run: npm install");
    process.exitCode = 1;
    return;
  }

  await mkdir(outputDir, { recursive: true });

  const results = [];
  let failed = false;
  for (const sound of sounds) {
    try {
      results.push(await optimizeSound(sound));
    } catch (error) {
      failed = true;
      results.push(`FAILED ${sound.target}: ${error.message}`);
    }
  }

  console.log(`Processed ${results.length} sounds.`);
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Sound optimization failed.");
  console.error(error);
  process.exitCode = 1;
});
