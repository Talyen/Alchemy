import { SOUND_ENTRY_OWNERS } from "./asset-constants.mjs";
import { validateRegistryEntries } from "./registry-validation.mjs";

/** Raw sound sources transformed or copied into public/sounds. */
export const generatedSoundAssets = [
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/bleed-tick-soft-wet-impact-299cd309-0-850.wav",
    target: "bleed-tick-soft-wet-impact-299cd309-0-850.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/armor-gain-leather-rustle-ba8ddcf0-0-930.wav",
    target: "armor-gain-leather-rustle-ba8ddcf0-0-930.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/crystal-bulwark-soft-cast-4ab78de8-0-1600.wav",
    target: "crystal-bulwark-soft-cast-4ab78de8-0-1600.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/plate-mail-gear-movement-fcea0d3b.wav",
    target: "plate-mail-gear-movement-fcea0d3b.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/combat/weapons/sword_attack_01.ogg",
    target: "sword-attack-1.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/combat/weapons/sword_attack_03.ogg",
    target: "sword-attack-3.ogg",
  },
  {
    source: "Sounds/Game Sources/Sound Effects/combat/defense/block_01.ogg",
    target: "sword-blocked-1.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/outcomes/events/mystery_event_02.wav",
    target: "harpsichord-mystery.ogg",
  },
  {
    source: "Sounds/Game Sources/Sound Effects/magic/elemental/fire/fireball_01.ogg",
    target: "fireball-1.ogg",
  },
  {
    source: "Sounds/Game Sources/Sound Effects/magic/elemental/ice/ice_throw_01.ogg",
    target: "ice-throw-1.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/combat/weapons/sword_slice.wav",
    target: "sword-slice.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/cards/hand/card_fan.wav",
    target: "card-fan.ogg",
  },
  {
    source: "Sounds/Game Sources/Sound Effects/cards/hand/card_draw_02.wav",
    target: "card-draw-2.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/interface/toggles/toggle_off_02.wav",
    target: "toggle-off.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/interface/feedback/denied.wav",
    target: "denied-03.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/world/environment/fire_lighting.wav",
    target: "fire-lighting.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/outcomes/progression/harpsichord_level_complete.wav",
    target: "harpsichord-level-complete.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/outcomes/defeat/harpsichord_defeated.wav",
    target: "harpsichord-defeated.ogg",
  },
  {
    source: "Sounds/Game Sources/Sound Effects/outcomes/defeat/deaths_door.wav",
    target: "horror-sting.ogg",
  },
  {
    source: "Sounds/Game Sources/Sound Effects/outcomes/events/mystery_event.wav",
    target: "music-box-mystery.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/world/liquids/ice_in_water.wav",
    target: "ice-in-water.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/outcomes/progression/music_box_chime_positive.wav",
    target: "music-box-chime-positive.ogg",
  },
  {
    source: "Sounds/Game Sources/Sound Effects/magic/support/buff_01.wav",
    target: "buff-pickup.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/magic/support/buff_pickup_04.wav",
    target: "buff-pickup-1.ogg",
  },
  {
    source: "Sounds/Game Sources/Sound Effects/combat/attacks/hit_01.wav",
    target: "swish-hit.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/combat/attacks/strong_punch_03.wav",
    target: "strong-punch.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/magic/arcana/energy_noise_01.wav",
    target: "energy-noise.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/combat/attacks/gut_kick_01.wav",
    target: "gut-kick.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/combat/attacks/sword_impact_02.ogg",
    target: "sword-impact-hit-2.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/homestead/gathering/mine_02.ogg",
    target: "mine-2.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/harpsichord-chime-positive-f88163a6-0-1144.wav",
    target: "harpsichord-chime-positive-f88163a6-0-1144.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/harpsichord-negative-quick-fd60821c-0-1146.wav",
    target: "harpsichord-negative-quick-fd60821c-0-1146.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/hand-to-hand-combat-body-hits-deep-punch-02-2265fdc2-0-208.wav",
    target: "hand-to-hand-combat-body-hits-deep-punch-02-2265fdc2-0-208.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/weapon-impact-parry-01-1b12234a-0-922.wav",
    target: "weapon-impact-parry-01-1b12234a-0-922.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/sword-clash-02-57d075a4-0-267.wav",
    target: "sword-clash-02-57d075a4-0-267.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/magic-ice-whoosh-ice-bloc-debris-01-2eb4176c-0-2352.wav",
    target: "magic-ice-whoosh-ice-bloc-debris-01-2eb4176c-0-2352.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/fireball-02-e587c4fa-0-3000.wav",
    target: "fireball-02-e587c4fa-0-3000.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/monster-bite-3-7193d1d8-0-1339.wav",
    target: "monster-bite-3-7193d1d8-0-1339.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/hkap2-spin-whoosh-2a-261f31e9-0-608.wav",
    target: "hkap2-spin-whoosh-2a-261f31e9-0-608.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/ilmarinen-blacksmith-forge-hammer-anvil-strik-0f11505a-0-432.wav",
    target: "ilmarinen-blacksmith-forge-hammer-anvil-strik-0f11505a-0-432.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/ice-impact-debris-heavy-single-fienup-015-sis-3d39507f-0-1413.wav",
    target: "ice-impact-debris-heavy-single-fienup-015-sis-3d39507f-0-1413.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/texture-whoosh-02-fast-02-1c520254-0-835.wav",
    target: "texture-whoosh-02-fast-02-1c520254-0-835.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/clothing-movement-01-786d2b95-0-1572.wav",
    target: "clothing-movement-01-786d2b95-0-1572.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/liquids-gingerbeer-pour-plop-gurgling-fizzy-e-79e9e572-0-4000.wav",
    target: "liquids-gingerbeer-pour-plop-gurgling-fizzy-e-79e9e572-0-4000.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/grand-piano-chime-positive-e36bc9a2-0-979.wav",
    target: "grand-piano-chime-positive-e36bc9a2-0-979.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/music-box-level-complete-062b379c-0-4197.wav",
    target: "music-box-level-complete-062b379c-0-4197.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/burning-house-t4-fire-low-intensity-with-crac-69b70331-0-12000.wav",
    target: "burning-house-t4-fire-low-intensity-with-crac-69b70331-0-12000.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/atmo-eerie-cave-water-drips-emptyness-howling-f2038732-0-12000.wav",
    target: "atmo-eerie-cave-water-drips-emptyness-howling-f2038732-0-12000.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/ground-impact-large-falling-rocks-various-04-2f578e6a-0-5305.wav",
    target: "ground-impact-large-falling-rocks-various-04-2f578e6a-0-5305.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/dice-roll-01-b4d30a6d-0-430.wav",
    target: "dice-roll-01-b4d30a6d-0-430.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/lightning-impact-ac84ed8a-0-2000.wav",
    target: "lightning-impact-ac84ed8a-0-2000.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/bow-attack-01-626d2d6d-0-3000.wav",
    target: "bow-attack-01-626d2d6d-0-3000.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/bow-attack-02-d2ecb917-0-3000.wav",
    target: "bow-attack-02-d2ecb917-0-3000.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/bread-curst-bite-mouth-close-chew-crunch-vari-fefd384f-0-1440.wav",
    target: "bread-curst-bite-mouth-close-chew-crunch-vari-fefd384f-0-1440.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/dark-spell-life-tap-03-dd1d0dd1-0-2754.wav",
    target: "dark-spell-life-tap-03-dd1d0dd1-0-2754.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/efx-int-mutt-growl-42-b-ef1caab1-0-2443.wav",
    target: "efx-int-mutt-growl-42-b-ef1caab1-0-2443.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/wood-breaking-cracking-snapping-breaking-peel-d8b1cf2e-0-1333.wav",
    target: "wood-breaking-cracking-snapping-breaking-peel-d8b1cf2e-0-1333.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/coins-pouch-leather-drop-into-takes-3-bbe032a5-0-2000.wav",
    target: "coins-pouch-leather-drop-into-takes-3-bbe032a5-0-2000.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/battle-focus-church-choir-dm-a47d5cbc-0-2500.wav",
    target: "battle-focus-church-choir-dm-a47d5cbc-0-2500.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/battle-focus-purge-01-ef2ba588-0-1500.wav",
    target: "battle-focus-purge-01-ef2ba588-0-1500.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/battle-focus-arcane-metal-01-5abcc0c6-250-1500.wav",
    target: "battle-focus-arcane-metal-01-5abcc0c6-250-1500.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/battle-focus-impact-sound-design-hit-chime-resonant-f6318a19-0-1500.wav",
    target: "battle-focus-impact-sound-design-hit-chime-resonant-f6318a19-0-1500.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/battle-focus-church-choir-dm-a47d5cbc-0-1500.wav",
    target: "battle-focus-church-choir-dm-a47d5cbc-0-1500.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/battle-focus-illusion-mystery-magical-water-44c5b75b-0-1500.wav",
    target: "battle-focus-illusion-mystery-magical-water-44c5b75b-0-1500.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/battle-focus-magspel-cast-casting-buff-hy-pc-6b612bab-50-1500.wav",
    target: "battle-focus-magspel-cast-casting-buff-hy-pc-6b612bab-50-1500.ogg",
  },
  {
    source:
      "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved/battle-focus-magic-generic-haunted-old-grimoire-open-f8eb7607-280-1500.wav",
    target: "battle-focus-magic-generic-haunted-old-grimoire-open-f8eb7607-280-1500.ogg",
  },
  {
    source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/curated/coins-gather-quick.ogg",
    target: "coins-gather-quick.ogg",
  },
  { source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/curated/punch-3.ogg", target: "punch-3.ogg" },
  { source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/curated/squelching-4.ogg", target: "squelching-4.ogg" },
  { source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/curated/swipe.ogg", target: "swipe.ogg" },
  { source: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/curated/whoosh-1.ogg", target: "whoosh-1.ogg" },
];

/** Committed sounds without raw sources that remain owned by the sound pipeline. */
export const curatedSoundFiles = [];

/** Validate sound ownership before the optimizer writes outputs. */
export async function validateSoundAssetRegistry({ sourceDir } = {}) {
  const errors = [];
  const targetPattern = /^[^/\\]+\.ogg$/u;
  try {
    await validateRegistryEntries(generatedSoundAssets, {
      sourceDir,
      sourcePattern: /\.(ogg|wav|mp3)$/iu,
      targetPattern,
      caseInsensitiveDuplicates: true,
      label: "Sound asset registry",
      reservedTargets: curatedSoundFiles,
      reservedMessage: (target) => `Sound target is both generated and curated: "${target}".`,
    });
    await validateRegistryEntries(
      curatedSoundFiles.map((target) => ({ target })),
      {
        targetPattern,
        caseInsensitiveDuplicates: true,
        label: "Curated sound registry",
      },
    );
  } catch (error) {
    const details = error instanceof Error ? error.cause?.details : undefined;
    if (Array.isArray(details)) {
      for (const detail of details) errors.push(String(detail));
    } else {
      errors.push(error instanceof Error ? error.message : String(error));
    }
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
