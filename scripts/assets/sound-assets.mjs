import { validateRegistryEntries } from "../lib/registry-validation.mjs";

/** Raw sound sources transformed or copied into public/sounds. */
export const generatedSoundAssets = [
  { source: "Attacks and Combat/Sword Attacks Hits and Blocks/Sword Attack 1.ogg", target: "sword-attack-1.ogg" },
  { source: "Attacks and Combat/Sword Attacks Hits and Blocks/Sword Attack 3.ogg", target: "sword-attack-3.ogg" },
  { source: "Attacks and Combat/Sword Attacks Hits and Blocks/Sword Blocked 1.ogg", target: "sword-blocked-1.ogg" },
  { source: "Spells/Rock Meteor Swarm 1.ogg", target: "rock-meteor-swarm-1.ogg" },
  { source: "Musical Effects/harpsichord_mystery.wav", target: "harpsichord-mystery.ogg" },
  { source: "Spells/Fireball 1.ogg", target: "fireball-1.ogg" },
  { source: "Spells/Ice Throw 1.ogg", target: "ice-throw-1.ogg" },
  { source: "Torch/Torch Attack Strike 1.ogg", target: "torch-attack-strike-1.ogg" },
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
  { source: "UI/metal button 4.wav", target: "metal-button-4.ogg" },
  { source: "Card and Board/card_draw_3.wav", target: "card-draw-3.ogg" },
  { source: "UI/toggle_on.wav", target: "toggle-on.ogg" },
  { source: "UI/033_Denied_03.wav", target: "denied-03.ogg" },
  { source: "Environment/fire_lighting.wav", target: "fire-lighting.ogg" },
  { source: "Musical Effects/harpsichord_level_complete.wav", target: "harpsichord-level-complete.ogg" },
  { source: "Items/page_turn.wav", target: "page-turn.ogg" },
  { source: "Materials/paper_move.wav", target: "paper-move.ogg" },
  { source: "Musical Effects/harpsichord_defeated.wav", target: "harpsichord-defeated.ogg" },
  { source: "Musical Effects/horror_sting.wav", target: "horror-sting.ogg" },
  { source: "Musical Effects/music_box_mystery.wav", target: "music-box-mystery.ogg" },
  { source: "Environment/ice_in_water.wav", target: "ice-in-water.ogg" },
  { source: "Musical Effects/music_box_chime_positive.wav", target: "music-box-chime-positive.ogg" },
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
  { source: "Chopping and Mining/mine 2.ogg", target: "mine-2.ogg" },
];

/** Committed sounds without raw sources that remain owned by the sound pipeline. */
export const curatedSoundFiles = [
  "coins-gather-quick.ogg",
  "gurgling.ogg",
  "keys-jingling.ogg",
  "kick.ogg",
  "power-down.ogg",
  "punch-3.ogg",
  "splat-quick.ogg",
  "squelching-4.ogg",
  "swipe.ogg",
  "vibraphone-chime-quick.ogg",
  "whoosh-1.ogg",
  "whoosh-2.ogg",
  "sci-fi-error.ogg",
];

/** Validate sound ownership before the optimizer writes outputs. */
export async function validateSoundAssetRegistry({ sourceDir } = {}) {
  const errors = [];
  try {
    await validateRegistryEntries(generatedSoundAssets, {
      sourceDir,
      sourcePattern: /\.(ogg|wav|mp3)$/iu,
      targetPattern: /\.ogg$/u,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const lines = msg.split("\n").filter((line) => line.startsWith("- "));
    if (lines.length > 0) {
      for (const line of lines) errors.push(line.slice(2));
    } else if (msg.includes("Registry validation failed:")) {
      const after = msg.slice(msg.indexOf("Registry validation failed:") + "Registry validation failed:".length).trim();
      if (after) errors.push(after);
      else errors.push(msg);
    } else {
      errors.push(msg);
    }
  }

  const generatedTargets = new Set(generatedSoundAssets.map((e) => e.target));
  for (const file of curatedSoundFiles) {
    if (!file.endsWith(".ogg")) errors.push(`Curated sound must be OGG: "${file}".`);
    if (generatedTargets.has(file)) errors.push(`Sound target is both generated and curated: "${file}".`);
  }

  if (errors.length > 0) throw new Error(`Sound asset registry validation failed:\n- ${errors.join("\n- ")}`);
}
