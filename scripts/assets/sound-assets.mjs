import { validateRegistryEntries } from "../lib/registry-validation.mjs";

/** Raw sound sources transformed or copied into public/sounds. */
export const generatedSoundAssets = [
  { source: "combat/weapons/sword_attack_01.ogg", target: "sword-attack-1.ogg" },
  { source: "combat/weapons/sword_attack_03.ogg", target: "sword-attack-3.ogg" },
  { source: "combat/defense/block_01.ogg", target: "sword-blocked-1.ogg" },
  { source: "magic/elemental/earth/rock_meteor_swarm_01.ogg", target: "rock-meteor-swarm-1.ogg" },
  { source: "outcomes/events/mystery_event_02.wav", target: "harpsichord-mystery.ogg" },
  { source: "magic/elemental/fire/fireball_01.ogg", target: "fireball-1.ogg" },
  { source: "magic/elemental/ice/ice_throw_01.ogg", target: "ice-throw-1.ogg" },
  { source: "combat/attacks/torch_attack_strike_01.ogg", target: "torch-attack-strike-1.ogg" },
  {
    source: "combat/attacks/sword_impact_01.ogg",
    target: "sword-impact-hit-1.ogg",
  },
  { source: "combat/weapons/sword_slice.wav", target: "sword-slice.ogg" },
  { source: "combat/defense/sword_blocked_01.ogg", target: "sword-blocked-2.ogg" },
  { source: "combat/weapons/sword_clash.wav", target: "sword-clash.ogg" },
  { source: "magic/elemental/ice/freeze_01.ogg", target: "ice-freeze-1.ogg" },
  { source: "combat/attacks/torch_impact_01.ogg", target: "torch-impact-1.ogg" },
  { source: "cards/hand/card_fan.wav", target: "card-fan.ogg" },
  { source: "cards/hand/card_draw_01.wav", target: "card-draw-1.ogg" },
  { source: "cards/hand/card_draw_02.wav", target: "card-draw-2.ogg" },
  { source: "interface/toggles/toggle_off_02.wav", target: "toggle-off.ogg" },
  { source: "interface/buttons/metal_button_04.wav", target: "metal-button-4.ogg" },
  { source: "cards/hand/card_draw_03.wav", target: "card-draw-3.ogg" },
  { source: "interface/toggles/toggle_on_02.wav", target: "toggle-on.ogg" },
  { source: "interface/feedback/denied.wav", target: "denied-03.ogg" },
  { source: "world/environment/fire_lighting.wav", target: "fire-lighting.ogg" },
  { source: "outcomes/progression/harpsichord_level_complete.wav", target: "harpsichord-level-complete.ogg" },
  { source: "items/containers/page_turn.wav", target: "page-turn.ogg" },
  { source: "world/materials/paper_move.wav", target: "paper-move.ogg" },
  { source: "outcomes/defeat/harpsichord_defeated.wav", target: "harpsichord-defeated.ogg" },
  { source: "outcomes/defeat/deaths_door.wav", target: "horror-sting.ogg" },
  { source: "outcomes/events/mystery_event.wav", target: "music-box-mystery.ogg" },
  { source: "world/liquids/ice_in_water.wav", target: "ice-in-water.ogg" },
  { source: "outcomes/progression/music_box_chime_positive.wav", target: "music-box-chime-positive.ogg" },
  { source: "magic/support/buff_01.wav", target: "buff-pickup.ogg" },
  { source: "magic/support/buff_pickup_04.wav", target: "buff-pickup-1.ogg" },
  { source: "combat/attacks/hit_01.wav", target: "swish-hit.ogg" },
  { source: "combat/attacks/strong_punch_03.wav", target: "strong-punch.ogg" },
  { source: "magic/arcana/energy_noise_01.wav", target: "energy-noise.ogg" },
  { source: "combat/attacks/gut_kick_01.wav", target: "gut-kick.ogg" },
  { source: "magic/support/bonus_regen_rate_05.wav", target: "bonus-regen-rate.ogg" },
  {
    source: "combat/attacks/sword_impact_02.ogg",
    target: "sword-impact-hit-2.ogg",
  },
  { source: "homestead/gathering/mine_02.ogg", target: "mine-2.ogg" },
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
    const details = error instanceof Error ? error.cause?.details : undefined;
    if (Array.isArray(details)) {
      for (const detail of details) errors.push(String(detail));
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      const lines = msg.split("\n").filter((line) => line.startsWith("- "));
      if (lines.length > 0) {
        for (const line of lines) errors.push(line.slice(2));
      } else if (msg.includes("Registry validation failed:")) {
        const after = msg
          .slice(msg.indexOf("Registry validation failed:") + "Registry validation failed:".length)
          .trim();
        if (after) errors.push(after);
        else errors.push(msg);
      } else {
        errors.push(msg);
      }
    }
  }

  const generatedTargets = new Set(generatedSoundAssets.map((e) => e.target));
  for (const file of curatedSoundFiles) {
    if (!file.endsWith(".ogg")) errors.push(`Curated sound must be OGG: "${file}".`);
    if (generatedTargets.has(file)) errors.push(`Sound target is both generated and curated: "${file}".`);
  }

  if (errors.length > 0) throw new Error(`Sound asset registry validation failed:\n- ${errors.join("\n- ")}`);
}
