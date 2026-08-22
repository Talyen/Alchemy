// ============ Audio ============
export const DEFAULT_MUSIC_VOLUME = 0.0875;
export const MUSIC_BASE_PATH = "Music/";

// Music transition timing and gain staging. MUSIC_MASTER_GAIN is an additional layer
// on top of user music volume and master volume — the final volume is userMusic * master * MUSIC_MASTER_GAIN.
export const FADE_OUT_DURATION = 300;
export const FADE_IN_DELAY = 600;
export const FADE_IN_DURATION = 1400;
export const MUSIC_MASTER_GAIN = 0.2;

// ============ SFX Volume ============
export const DEFAULT_SFX_VOLUME = 0.35;
export const SFX_UI_VOLUME = 0.6;
export const SFX_VICTORY_VOLUME = 0.8;
export const SFX_DEFEAT_VOLUME = 0.7;
/** Slice death whoosh — quieter than the victory stinger it overlaps. */
export const SFX_SLICE_DEATH_VOLUME = 0.55;

// ============ SFX Cooldown ============
export const SFX_COOLDOWN_MS = 80;

// ============ Image / Asset Preloading ============
export const IMAGE_PRELOAD_BATCH_SIZE = 4;
export const IMAGE_PRELOAD_TIMEOUT_MS = 15_000;

// ============ Screen Transitions ============
export const MOTION_FADE_MS = 180;
export const PAGE_EXIT_MS = 180;

// ============ Startup Loading ============
export const INITIAL_LOAD_MIN_DURATION_MS = 650;
export const FONT_PRELOAD_TIMEOUT_MS = 10_000;
export const STARTUP_LOAD_IMAGE_WEIGHT = 0.85;
export const STARTUP_LOAD_FONT_WEIGHT = 0.05;
export const STARTUP_LOAD_BOOTSTRAP_WEIGHT = 0.1;
export const STARTUP_BAR_INCOMPLETE_CAP = 0.92;
export const STARTUP_BAR_TAU_MS = 220;
export const STARTUP_BAR_TRICKLE_PER_SEC = 0.04;
export const STARTUP_BAR_REVEAL_THRESHOLD = 0.995;

// ============ Animation / Timing ============
export const SHIMMER_COOLDOWN_MS = 350;
export const COMBAT_TEXT_LIFETIME_MS = 3300;
export const COMBAT_TEXT_LANE_DELAY_MS = 80;
export const COMBAT_TEXT_MAX_VISIBLE_PER_RAIL = 3;
export const CARD_ACTIVATION_ROTATION_DEGREES = 4.2;

export const CARD_TRANSFER_CONFIG = {
  drawDurationSeconds: 0.5,
  discardDurationSeconds: 0.5,
  completionBufferMs: 120,
  requiredStableSlotFrames: 2,
  maxSlotStabilizeFrames: 12,
  soundVolume: 0.4,
  stableRectTimeoutMs: 2000,
  rectEpsilonPx: 0.5,
  batchSpeedMultipliers: {
    small: 1,
    medium: 1.4,
    large: 1.6,
    mediumCardCount: 3,
    smallMaxCardCount: 2,
  },
  discardFlipKeyframes: [0, 90, 180],
  drawFlipKeyframes: [180, 90, 0],
} as const;

// ============ Layout ============
export const GHOST_TRAVEL_SCALE = 0.74;
export const GHOST_PLAYER_OFFSET_RATIO = 0.16;
export const GHOST_TARGET_Y_RATIO = 0.82;
export const GHOST_FALLBACK_WIDTH_PX = 160;
export const GHOST_FALLBACK_HEIGHT_PX = 220;
export const GHOST_FALLBACK_CENTER_Y_RATIO = 0.3;
export const BATTLE_PARTICLE_ALPHA_NORMAL = 1.7;
export const BATTLE_PARTICLE_ALPHA_BOSS = 2.5;
export const STAGE_HEIGHT = 1080;
export const MIN_STAGE_SCALE = 0.3;
export const MAX_STAGE_SCALE = 2.0;

// ============ Collection ============
export const COLLECTION_PAGE_SIZE = 8;
export const BESTIARY_PAGE_SIZE = 6;
export const TRINKET_PAGE_SIZE = 8;
export const SELECTION_GRID_PAGE_SIZE = 8;
export const BATTLE_ACTOR_TOP = "34%";
export const HAND_FAN_VERTICAL_STEP_PX = 10;
export const HAND_FAN_ROTATION_DEGREES = 4.2;
export const HAND_REST_DROP_PX = 12;
export const HAND_HOVER_LIFT_PX = 26;
export const HAND_HOVER_ROTATION_DEGREES = 2.6;
export const HAND_HOVER_SCALE = 1.03;
/** Gap between a hovered hand card and its detail tooltip (PortaledTooltip padding). */
export const HAND_HOVER_TOOLTIP_PADDING_PX = 16;
/** Delay before clearing hand hover so a sibling card can claim it first. */
export const HAND_HOVER_HANDOFF_MS = 50;
export const HAND_CARD_BASE_Z_INDEX = 10;
export const HAND_CARD_HOVER_Z_INDEX = 40;
/** Battle wish overlay and flying card transfer layer — keep in sync with `--z-wish-overlay` in index.css. */
export const WISH_OVERLAY_Z_INDEX = 90;
