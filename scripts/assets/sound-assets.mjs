import { assetGroup } from "./asset-group.mjs";
import { SOUND_ENTRY_OWNERS } from "./asset-constants.mjs";
import { validateRegistryEntries } from "./registry-validation.mjs";

/** Raw sound sources transformed or copied into public/sounds. */
export const generatedSoundAssets = [
  ...assetGroup({ folder: "Sounds/Game Sources", settings: {}, targetExtension: ".ogg" }, [
    ["Projects/Trinket/Sound Effects/combat/attacks/hit_stun_01.wav", "fit-hit-stun.ogg"],
    ["Projects/Trinket/Sound Effects/combat/attacks/hit_holy_01.ogg", "fit-hit-holy.ogg"],
    ["Sound Effects/combat/attacks/sword_impact_01.ogg", "fit-hit-piercing.ogg"],
    ["Projects/Trinket/Sound Effects/magic/support/heal_01.wav", "fit-heal.ogg"],
    ["Sound Effects/magic/elemental/ice/freeze_01.ogg", "fit-control-freeze.ogg"],
    ["Projects/Trinket/Sound Effects/combat/status/stun_01.wav", "fit-control-stun.ogg"],
    ["Projects/Trinket/Sound Effects/combat/defense/dodge_01.wav", "fit-dodge.ogg"],
    ["Projects/Trinket/Sound Effects/progression/salvage_01.wav", "fit-item-salvage.ogg"],
    ["Projects/Trinket/Sound Effects/progression/talent_unlock_01.wav", "fit-talent-unlock.ogg"],
    ["Projects/Trinket/Sound Effects/outcomes/victory/victory_01.wav", "fit-victory.ogg"],
    ["Projects/Trinket/Sound Effects/interface/toggles/toggle_on.wav", "fit-ui-toggle-on.ogg"],
    ["Projects/Trinket/Sound Effects/interface/toggles/toggle_off.wav", "fit-ui-toggle-off.ogg"],
    ["Projects/Trinket/Sound Effects/progression/homestead_build_01.wav", "fit-homestead-build.ogg"],
    ["Projects/Trinket/Sound Effects/magic/support/purge_01.wav", "fit-purge.ogg"],
    ["Sound Effects/Shared Revisions/sound_fit_20261015/body_hit_critical.wav", "fit-hit-critical.ogg"],
    ["Projects/Trinket/Sound Effects/combat/attacks/hit_burn_critical_01.wav", "fit-hit-burn-critical.ogg"],
    ["Projects/Trinket/Sound Effects/combat/attacks/hit_freeze_critical_01.wav", "fit-hit-freeze-critical.ogg"],
    ["Projects/Trinket/Sound Effects/combat/attacks/hit_stun_critical_01.wav", "fit-hit-stun-critical.ogg"],
    ["Projects/Trinket/Sound Effects/combat/attacks/hit_piercing_critical_01.wav", "fit-hit-piercing-critical.ogg"],
    ["Projects/Trinket/Sound Effects/combat/attacks/hit_holy_critical_01.wav", "fit-hit-holy-critical.ogg"],
    ["Sound Effects/Shared Revisions/sound_fit_20261015/slash_critical.wav", "fit-attack-slash-critical.ogg"],
    ["Sound Effects/Shared Revisions/sound_fit_20261015/stab_critical.wav", "fit-attack-stab-critical.ogg"],
    ["Sound Effects/Shared Revisions/sound_fit_20261015/astral_bow_burn.wav", "fit-astral-bow-burn.ogg"],
    ["Sound Effects/Shared Revisions/sound_fit_20261015/astral_bow_freeze.wav", "fit-astral-bow-freeze.ogg"],
    ["Sound Effects/Shared Revisions/sound_fit_20261015/astral_bow_piercing.wav", "fit-astral-bow-piercing.ogg"],
    [
      "Sound Effects/Shared Revisions/sound_fit_20261015/astral_bow_burn_critical.wav",
      "fit-astral-bow-burn-critical.ogg",
    ],
    [
      "Sound Effects/Shared Revisions/sound_fit_20261015/astral_bow_freeze_critical.wav",
      "fit-astral-bow-freeze-critical.ogg",
    ],
    [
      "Sound Effects/Shared Revisions/sound_fit_20261015/astral_bow_piercing_critical.wav",
      "fit-astral-bow-piercing-critical.ogg",
    ],
    [
      "Sound Effects/Shared Revisions/sound_fit_20261015/rock_impact_short.wav",
      "ground-impact-large-falling-rocks-various-04-2f578e6a-0-5305.ogg",
    ],
  ]),
  ...assetGroup(
    { folder: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved", settings: {}, targetExtension: ".ogg" },
    [
      "bleed-tick-soft-wet-impact-299cd309-0-850.wav",
      "armor-gain-leather-rustle-ba8ddcf0-0-930.wav",
      "crystal-bulwark-soft-cast-4ab78de8-0-1600.wav",
      "plate-mail-gear-movement-fcea0d3b.wav",
    ],
  ),
  ...assetGroup({ folder: "Sounds/Game Sources", settings: {}, targetExtension: ".ogg" }, [
    ["Projects/Alchemy/Sound Effects/combat/weapons/sword_attack_01.ogg", "sword-attack-1.ogg"],
    ["Projects/Alchemy/Sound Effects/combat/weapons/sword_attack_03.ogg", "sword-attack-3.ogg"],
    ["Sound Effects/combat/defense/block_01.ogg", "sword-blocked-1.ogg"],
    ["Projects/Alchemy/Sound Effects/outcomes/events/mystery_event_02.wav", "harpsichord-mystery.ogg"],
    ["Sound Effects/magic/elemental/fire/fireball_01.ogg", "fireball-1.ogg"],
    ["Sound Effects/magic/elemental/ice/ice_throw_01.ogg", "ice-throw-1.ogg"],
    ["Projects/Alchemy/Sound Effects/combat/weapons/sword_slice.wav", "sword-slice.ogg"],
    ["Projects/Alchemy/Sound Effects/cards/hand/card_fan.wav", "card-fan.ogg"],
    ["Sound Effects/cards/hand/card_draw_02.wav", "card-draw-2.ogg"],
    ["Projects/Alchemy/Sound Effects/interface/toggles/toggle_off_02.wav", "toggle-off.ogg"],
    ["Projects/Alchemy/Sound Effects/interface/feedback/denied.wav", "denied-03.ogg"],
    ["Projects/Alchemy/Sound Effects/world/environment/fire_lighting.wav", "fire-lighting.ogg"],
    ["Projects/Alchemy/Sound Effects/outcomes/defeat/harpsichord_defeated.wav", "harpsichord-defeated.ogg"],
    ["Sound Effects/outcomes/defeat/deaths_door.wav", "horror-sting.ogg"],
    ["Sound Effects/outcomes/events/mystery_event.wav", "music-box-mystery.ogg"],
    ["Projects/Alchemy/Sound Effects/world/liquids/ice_in_water.wav", "ice-in-water.ogg"],
    ["Sound Effects/magic/support/buff_01.wav", "buff-pickup.ogg"],
    ["Projects/Alchemy/Sound Effects/magic/support/buff_pickup_04.wav", "buff-pickup-1.ogg"],
    ["Sound Effects/combat/attacks/hit_01.wav", "swish-hit.ogg"],
    ["Projects/Alchemy/Sound Effects/combat/attacks/strong_punch_03.wav", "strong-punch.ogg"],
    ["Projects/Alchemy/Sound Effects/magic/arcana/energy_noise_01.wav", "energy-noise.ogg"],
    ["Projects/Alchemy/Sound Effects/combat/attacks/gut_kick_01.wav", "gut-kick.ogg"],
  ]),
  ...assetGroup(
    { folder: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/approved", settings: {}, targetExtension: ".ogg" },
    [
      "harpsichord-chime-positive-f88163a6-0-1144.wav",
      "harpsichord-negative-quick-fd60821c-0-1146.wav",
      "hand-to-hand-combat-body-hits-deep-punch-02-2265fdc2-0-208.wav",
      "weapon-impact-parry-01-1b12234a-0-922.wav",
      "magic-ice-whoosh-ice-bloc-debris-01-2eb4176c-0-2352.wav",
      "fireball-02-e587c4fa-0-3000.wav",
      "monster-bite-3-7193d1d8-0-1339.wav",
      "ilmarinen-blacksmith-forge-hammer-anvil-strik-0f11505a-0-432.wav",
      "ice-impact-debris-heavy-single-fienup-015-sis-3d39507f-0-1413.wav",
      "texture-whoosh-02-fast-02-1c520254-0-835.wav",
      "clothing-movement-01-786d2b95-0-1572.wav",
      "liquids-gingerbeer-pour-plop-gurgling-fizzy-e-79e9e572-0-4000.wav",
      "grand-piano-chime-positive-e36bc9a2-0-979.wav",
      "music-box-level-complete-062b379c-0-4197.wav",
      "burning-house-t4-fire-low-intensity-with-crac-69b70331-0-12000.wav",
      "atmo-eerie-cave-water-drips-emptyness-howling-f2038732-0-12000.wav",
      "dice-roll-01-b4d30a6d-0-430.wav",
      "lightning-impact-ac84ed8a-0-2000.wav",
      "bow-attack-01-626d2d6d-0-3000.wav",
      "bow-attack-02-d2ecb917-0-3000.wav",
      "bread-curst-bite-mouth-close-chew-crunch-vari-fefd384f-0-1440.wav",
      "dark-spell-life-tap-03-dd1d0dd1-0-2754.wav",
      "efx-int-mutt-growl-42-b-ef1caab1-0-2443.wav",
      "wood-breaking-cracking-snapping-breaking-peel-d8b1cf2e-0-1333.wav",
      "battle-focus-church-choir-dm-a47d5cbc-0-2500.wav",
      "battle-focus-purge-01-ef2ba588-0-1500.wav",
      "battle-focus-arcane-metal-01-5abcc0c6-250-1500.wav",
      "battle-focus-church-choir-dm-a47d5cbc-0-1500.wav",
      "battle-focus-illusion-mystery-magical-water-44c5b75b-0-1500.wav",
      "battle-focus-magspel-cast-casting-buff-hy-pc-6b612bab-50-1500.wav",
      "battle-focus-magic-generic-haunted-old-grimoire-open-f8eb7607-280-1500.wav",
    ],
  ),
  ...assetGroup(
    { folder: "Sounds/Game Sources/Projects/Alchemy/Sound Effects/curated", settings: {}, targetExtension: ".ogg" },
    ["coins-gather-quick.ogg", "punch-3.ogg", "squelching-4.ogg", "swipe.ogg", "whoosh-1.ogg"],
  ),
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
