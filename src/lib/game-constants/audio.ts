// Audio volumes, music keys, and transition staging.

export const DEFAULT_MUSIC_VOLUME = 0.0875;
export const MUSIC_BASE_PATH = "Music/";

export const MUSIC_KEYS = {
  MENU: "menu",
  BATTLE: "battle",
  BOSS_FORGE_GOLEM: "boss-forge-golem",
  BOSS_FROSTWARDEN: "boss-frostwarden",
  BOSS_BLIGHT_TREANT: "boss-blight-treant",
  BOSS_IRON_BEAR: "boss-iron-bear",
} as const;

// Music transition timing and gain staging. MUSIC_MASTER_GAIN is an additional layer
// on top of user music volume and master volume — the final volume is userMusic * master * MUSIC_MASTER_GAIN.
// 0.7 keeps music a bit under combat SFX at equal sliders: music stems sit hotter (~-14 LUFS)
// than loudnorm'd SFX (~-16) and a continuous bed reads louder than equal-peak hits.
export const FADE_OUT_DURATION = 300;
export const FADE_IN_DELAY = 600;
export const FADE_IN_DURATION = 1400;
export const MUSIC_MASTER_GAIN = 0.7;

export const DEFAULT_SFX_VOLUME = 0.35;
export const SFX_UI_VOLUME = 0.6;
export const SFX_VICTORY_VOLUME = 0.8;
export const SFX_DEFEAT_VOLUME = 0.7;
/** Slice death whoosh — quieter than the victory stinger it overlaps. */
export const SFX_SLICE_DEATH_VOLUME = 0.55;

export const SFX_COOLDOWN_MS = 80;
