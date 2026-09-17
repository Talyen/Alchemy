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

// Battle companion id -> summon card id for attack sounds. Covers every
// companionLibrary id by the `${id}-companion` convention; the registry test
// pins both sides so new companions get a conscious sound decision.
export const COMPANION_SOUND_CARD_IDS: Record<string, string> = {
  wolf: "wolf-companion",
  "lizard-scout": "lizard-scout-companion",
  "frost-whelp": "frost-whelp-companion",
  bear: "bear-companion",
  panther: "panther-companion",
  phoenix: "phoenix-companion",
  skeleton: "skeleton-companion",
  pixie: "pixie-companion",
  "mana-moth": "mana-moth-companion",
  "will-o-wisp": "will-o-wisp-companion",
  "golden-retriever": "golden-retriever-companion",
  "shield-scarab": "shield-scarab-companion",
  "library-owl": "library-owl-companion",
  fox: "fox-companion",
};
