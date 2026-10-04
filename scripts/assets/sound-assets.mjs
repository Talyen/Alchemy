import { SOUND_ENTRY_OWNERS } from "./asset-constants.mjs";
import { validateRegistryEntries } from "./registry-validation.mjs";

/** Raw sound sources transformed or copied into public/sounds. */
export const generatedSoundAssets = [
  {
    source: "combat/weapons/sword_attack_01.ogg",
    target: "sword-attack-1.ogg",
  },
  {
    source: "combat/weapons/sword_attack_03.ogg",
    target: "sword-attack-3.ogg",
  },
  {
    source: "combat/defense/block_01.ogg",
    target: "sword-blocked-1.ogg",
  },
  {
    source: "outcomes/events/mystery_event_02.wav",
    target: "harpsichord-mystery.ogg",
  },
  {
    source: "magic/elemental/fire/fireball_01.ogg",
    target: "fireball-1.ogg",
  },
  {
    source: "magic/elemental/ice/ice_throw_01.ogg",
    target: "ice-throw-1.ogg",
  },
  {
    source: "combat/weapons/sword_slice.wav",
    target: "sword-slice.ogg",
  },
  {
    source: "cards/hand/card_fan.wav",
    target: "card-fan.ogg",
  },
  {
    source: "cards/hand/card_draw_01.wav",
    target: "card-draw-1.ogg",
  },
  {
    source: "cards/hand/card_draw_02.wav",
    target: "card-draw-2.ogg",
  },
  {
    source: "interface/toggles/toggle_off_02.wav",
    target: "toggle-off.ogg",
  },
  {
    source: "interface/feedback/denied.wav",
    target: "denied-03.ogg",
  },
  {
    source: "world/environment/fire_lighting.wav",
    target: "fire-lighting.ogg",
  },
  {
    source: "outcomes/progression/harpsichord_level_complete.wav",
    target: "harpsichord-level-complete.ogg",
  },
  {
    source: "outcomes/defeat/harpsichord_defeated.wav",
    target: "harpsichord-defeated.ogg",
  },
  {
    source: "outcomes/defeat/deaths_door.wav",
    target: "horror-sting.ogg",
  },
  {
    source: "outcomes/events/mystery_event.wav",
    target: "music-box-mystery.ogg",
  },
  {
    source: "world/liquids/ice_in_water.wav",
    target: "ice-in-water.ogg",
  },
  {
    source: "outcomes/progression/music_box_chime_positive.wav",
    target: "music-box-chime-positive.ogg",
  },
  {
    source: "magic/support/buff_01.wav",
    target: "buff-pickup.ogg",
  },
  {
    source: "magic/support/buff_pickup_04.wav",
    target: "buff-pickup-1.ogg",
  },
  {
    source: "combat/attacks/hit_01.wav",
    target: "swish-hit.ogg",
  },
  {
    source: "combat/attacks/strong_punch_03.wav",
    target: "strong-punch.ogg",
  },
  {
    source: "magic/arcana/energy_noise_01.wav",
    target: "energy-noise.ogg",
  },
  {
    source: "combat/attacks/gut_kick_01.wav",
    target: "gut-kick.ogg",
  },
  {
    source: "combat/attacks/sword_impact_02.ogg",
    target: "sword-impact-hit-2.ogg",
  },
  {
    source: "homestead/gathering/mine_02.ogg",
    target: "mine-2.ogg",
  },
  {
    source: "approved/button-assorted-03-fc496fdd-0-359.wav",
    target: "button-assorted-03-fc496fdd-0-359.ogg",
  },
  {
    source: "approved/switch-03-297909c3-0-640.wav",
    target: "switch-03-297909c3-0-640.ogg",
  },
  {
    source: "approved/harpsichord-chime-positive-f88163a6-0-1144.wav",
    target: "harpsichord-chime-positive-f88163a6-0-1144.ogg",
  },
  {
    source: "approved/harpsichord-negative-quick-fd60821c-0-1146.wav",
    target: "harpsichord-negative-quick-fd60821c-0-1146.ogg",
  },
  {
    source: "approved/hand-to-hand-combat-body-hits-deep-punch-02-2265fdc2-0-208.wav",
    target: "hand-to-hand-combat-body-hits-deep-punch-02-2265fdc2-0-208.ogg",
  },
  {
    source: "approved/weapon-impact-parry-01-1b12234a-0-922.wav",
    target: "weapon-impact-parry-01-1b12234a-0-922.ogg",
  },
  {
    source: "approved/sword-clash-02-57d075a4-0-267.wav",
    target: "sword-clash-02-57d075a4-0-267.ogg",
  },
  {
    source: "approved/magic-ice-whoosh-ice-bloc-debris-01-2eb4176c-0-2352.wav",
    target: "magic-ice-whoosh-ice-bloc-debris-01-2eb4176c-0-2352.ogg",
  },
  {
    source: "approved/fireball-02-e587c4fa-0-3000.wav",
    target: "fireball-02-e587c4fa-0-3000.ogg",
  },
  {
    source: "approved/monster-bite-3-7193d1d8-0-1339.wav",
    target: "monster-bite-3-7193d1d8-0-1339.ogg",
  },
  {
    source: "approved/hkap2-spin-whoosh-2a-261f31e9-0-608.wav",
    target: "hkap2-spin-whoosh-2a-261f31e9-0-608.ogg",
  },
  {
    source: "approved/heavy-armor-block-01-a169e2a5-0-2000.wav",
    target: "heavy-armor-block-01-a169e2a5-0-2000.ogg",
  },
  {
    source: "approved/ilmarinen-blacksmith-forge-hammer-anvil-strik-0f11505a-0-432.wav",
    target: "ilmarinen-blacksmith-forge-hammer-anvil-strik-0f11505a-0-432.ogg",
  },
  {
    source: "approved/ice-impact-debris-heavy-single-fienup-015-sis-3d39507f-0-1413.wav",
    target: "ice-impact-debris-heavy-single-fienup-015-sis-3d39507f-0-1413.ogg",
  },
  {
    source: "approved/texture-whoosh-02-fast-02-1c520254-0-835.wav",
    target: "texture-whoosh-02-fast-02-1c520254-0-835.ogg",
  },
  {
    source: "approved/clothing-movement-01-786d2b95-0-1572.wav",
    target: "clothing-movement-01-786d2b95-0-1572.ogg",
  },
  {
    source: "approved/coins-drop-carpet-06-396f065a-0-650.wav",
    target: "coins-drop-carpet-06-396f065a-0-650.ogg",
  },
  {
    source: "approved/liquids-gingerbeer-pour-plop-gurgling-fizzy-e-79e9e572-0-4000.wav",
    target: "liquids-gingerbeer-pour-plop-gurgling-fizzy-e-79e9e572-0-4000.ogg",
  },
  {
    source: "approved/grand-piano-chime-positive-e36bc9a2-0-979.wav",
    target: "grand-piano-chime-positive-e36bc9a2-0-979.ogg",
  },
  {
    source: "approved/music-box-level-complete-062b379c-0-4197.wav",
    target: "music-box-level-complete-062b379c-0-4197.ogg",
  },
  {
    source: "approved/burning-house-t4-fire-low-intensity-with-crac-69b70331-0-12000.wav",
    target: "burning-house-t4-fire-low-intensity-with-crac-69b70331-0-12000.ogg",
  },
  {
    source: "approved/atmo-eerie-cave-water-drips-emptyness-howling-f2038732-0-12000.wav",
    target: "atmo-eerie-cave-water-drips-emptyness-howling-f2038732-0-12000.ogg",
  },
  {
    source: "approved/ground-impact-large-falling-rocks-various-04-2f578e6a-0-5305.wav",
    target: "ground-impact-large-falling-rocks-various-04-2f578e6a-0-5305.ogg",
  },
  {
    source: "approved/dice-roll-01-b4d30a6d-0-430.wav",
    target: "dice-roll-01-b4d30a6d-0-430.ogg",
  },
  {
    source: "approved/lightning-impact-ac84ed8a-0-2000.wav",
    target: "lightning-impact-ac84ed8a-0-2000.ogg",
  },
  {
    source: "approved/bow-attack-01-626d2d6d-0-3000.wav",
    target: "bow-attack-01-626d2d6d-0-3000.ogg",
  },
  {
    source: "approved/bow-attack-02-d2ecb917-0-3000.wav",
    target: "bow-attack-02-d2ecb917-0-3000.ogg",
  },
  {
    source: "approved/bread-curst-bite-mouth-close-chew-crunch-vari-fefd384f-0-1440.wav",
    target: "bread-curst-bite-mouth-close-chew-crunch-vari-fefd384f-0-1440.ogg",
  },
  {
    source: "approved/dark-spell-life-tap-03-dd1d0dd1-0-2754.wav",
    target: "dark-spell-life-tap-03-dd1d0dd1-0-2754.ogg",
  },
  {
    source: "approved/efx-int-mutt-growl-42-b-ef1caab1-0-2443.wav",
    target: "efx-int-mutt-growl-42-b-ef1caab1-0-2443.ogg",
  },
  {
    source: "approved/wood-breaking-cracking-snapping-breaking-peel-d8b1cf2e-0-1333.wav",
    target: "wood-breaking-cracking-snapping-breaking-peel-d8b1cf2e-0-1333.ogg",
  },
  {
    source: "approved/coins-pouch-leather-drop-into-takes-3-bbe032a5-0-2000.wav",
    target: "coins-pouch-leather-drop-into-takes-3-bbe032a5-0-2000.ogg",
  },
  {
    source: "approved/creature-monster-attack-09-108cd42b-0-1854.wav",
    target: "creature-monster-attack-09-108cd42b-0-1854.ogg",
  },
  {
    source: "approved/battle-focus-church-choir-dm-a47d5cbc-0-2500.wav",
    target: "battle-focus-church-choir-dm-a47d5cbc-0-2500.ogg",
  },
  {
    source: "approved/battle-focus-purge-01-ef2ba588-0-1500.wav",
    target: "battle-focus-purge-01-ef2ba588-0-1500.ogg",
  },
  {
    source: "approved/battle-focus-arcane-metal-01-5abcc0c6-250-1500.wav",
    target: "battle-focus-arcane-metal-01-5abcc0c6-250-1500.ogg",
  },
  {
    source: "approved/battle-focus-impact-sound-design-hit-chime-resonant-f6318a19-0-1500.wav",
    target: "battle-focus-impact-sound-design-hit-chime-resonant-f6318a19-0-1500.ogg",
  },
  {
    source: "approved/battle-focus-church-choir-dm-a47d5cbc-0-1500.wav",
    target: "battle-focus-church-choir-dm-a47d5cbc-0-1500.ogg",
  },
  {
    source: "approved/battle-focus-illusion-mystery-magical-water-44c5b75b-0-1500.wav",
    target: "battle-focus-illusion-mystery-magical-water-44c5b75b-0-1500.ogg",
  },
  {
    source: "approved/battle-focus-magspel-cast-casting-buff-hy-pc-6b612bab-50-1500.wav",
    target: "battle-focus-magspel-cast-casting-buff-hy-pc-6b612bab-50-1500.ogg",
  },
  {
    source: "approved/battle-focus-magic-generic-haunted-old-grimoire-open-f8eb7607-280-1500.wav",
    target: "battle-focus-magic-generic-haunted-old-grimoire-open-f8eb7607-280-1500.ogg",
  },
  {
    source: "approved/battle-focus-heal-01-2847537e-0-1500.wav",
    target: "battle-focus-heal-01-2847537e-0-1500.ogg",
  },
  {
    source: "approved/battle-focus-plate-impact-hard-02-a6a1ca66-0-764.wav",
    target: "battle-focus-plate-impact-hard-02-a6a1ca66-0-764.ogg",
  },
  {
    source: "approved/battle-focus-magspel-cast-casting-buff-hy-pc-3b300b28-20-1500.wav",
    target: "battle-focus-magspel-cast-casting-buff-hy-pc-3b300b28-20-1500.ogg",
  },
  {
    source: "approved/battle-focus-creature-hiss-4-m-e9aede68-330-1500.wav",
    target: "battle-focus-creature-hiss-4-m-e9aede68-330-1500.ogg",
  },
  {
    source: "approved/battle-focus-bug-people-03-d2d3d05e-50-1387.wav",
    target: "battle-focus-bug-people-03-d2d3d05e-50-1387.ogg",
  },
];

/** Committed sounds without raw sources that remain owned by the sound pipeline. */
export const curatedSoundFiles = [
  "coins-gather-quick.ogg",
  "punch-3.ogg",
  "squelching-4.ogg",
  "swipe.ogg",
  "whoosh-1.ogg",
];

/** Validate sound ownership before the optimizer writes outputs. */
export async function validateSoundAssetRegistry({ sourceDir } = {}) {
  const errors = [];
  try {
    await validateRegistryEntries(generatedSoundAssets, {
      sourceDir,
      sourcePattern: /\.(ogg|wav|mp3)$/iu,
      targetPattern: /\.ogg$/u,
      label: "Sound asset registry",
      reservedTargets: curatedSoundFiles,
      reservedMessage: (target) => `Sound target is both generated and curated: "${target}".`,
    });
  } catch (error) {
    const details = error instanceof Error ? error.cause?.details : undefined;
    if (Array.isArray(details)) {
      for (const detail of details) errors.push(String(detail));
    } else {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  for (const file of curatedSoundFiles) {
    if (!file.endsWith(".ogg")) errors.push(`Curated sound must be OGG: "${file}".`);
  }

  if (errors.length > 0) throw new Error(`Sound asset registry validation failed:\n- ${errors.join("\n- ")}`);
}

/** Owner tag for a prepared OGG: generated transforms vs curated commits. MP3 fallbacks mirror their OGG source owner. */
export function soundEntryOwner(target, generatedTargets = new Set(generatedSoundAssets.map(({ target }) => target))) {
  return generatedTargets.has(target) ? SOUND_ENTRY_OWNERS.generated : SOUND_ENTRY_OWNERS.curated;
}

/** MP3 fallback sibling for a prepared OGG. */
export function mp3FallbackName(ogg) {
  return ogg.replace(/\.ogg$/i, ".mp3");
}
