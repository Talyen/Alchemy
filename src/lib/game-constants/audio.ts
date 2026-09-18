export const MUSIC_BASE_PATH = "Music/";
export const SOUNDS_BASE_PATH = "sounds/";

export const MUSIC_KEYS = {
  MENU: "menu",
  BATTLE: "battle",
  BOSS_FORGE_GOLEM: "boss-forge-golem",
  BOSS_FROSTWARDEN: "boss-frostwarden",
  BOSS_BLIGHT_TREANT: "boss-blight-treant",
  BOSS_IRON_BEAR: "boss-iron-bear",
} as const;

export const FADE_OUT_DURATION_MS = 300;
export const FADE_IN_DELAY_MS = 600;
export const FADE_IN_DURATION_MS = 1400;
export const MUSIC_MASTER_GAIN = 0.7;

export const SFX_UI_VOLUME = 0.6;
export const SFX_VICTORY_VOLUME = 0.8;
export const SFX_DEFEAT_VOLUME = 0.7;

export const SFX_SLICE_DEATH_VOLUME = 0.55;

export const SFX_COOLDOWN_MS = 80;

export const MUSIC_BOSS_VOLUME_BOOST = 2;
export const MUSIC_FADE_TICK_MS = 30;

// Battle companion ids with registered attack sounds. Values follow the
// `${id}-companion` convention and are derived below so a rename touches one
// list; the registry test pins both sides so new companions get a conscious
// sound decision.
const COMPANION_SOUND_IDS = [
  "wolf",
  "lizard-scout",
  "frost-whelp",
  "bear",
  "panther",
  "phoenix",
  "skeleton",
  "pixie",
  "mana-moth",
  "will-o-wisp",
  "golden-retriever",
  "shield-scarab",
  "library-owl",
  "fox",
] as const;

export const COMPANION_SOUND_CARD_IDS: Record<string, string> = Object.fromEntries(
  COMPANION_SOUND_IDS.map((id) => [id, `${id}-companion`] as const),
);
