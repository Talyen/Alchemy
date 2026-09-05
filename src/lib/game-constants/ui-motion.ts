export const IMAGE_PRELOAD_BATCH_SIZE = 4;
export const IMAGE_PRELOAD_TIMEOUT_MS = 15_000;

export const MOTION_FADE_MS = 180;
export const PAGE_EXIT_MS = MOTION_FADE_MS;
export const TOOLTIP_FADE_MS = MOTION_FADE_MS;

export const INITIAL_LOAD_MIN_DURATION_MS = 3000;
export const FONT_PRELOAD_TIMEOUT_MS = 10_000;
export const STARTUP_LOAD_IMAGE_WEIGHT = 0.85;
export const STARTUP_LOAD_FONT_WEIGHT = 0.05;
export const STARTUP_LOAD_BOOTSTRAP_WEIGHT = 0.1;
export const STARTUP_BAR_INCOMPLETE_CAP = 0.92;
export const STARTUP_BAR_TAU_MS = 220;
export const STARTUP_BAR_TRICKLE_PER_SEC = 0.04;
export const STARTUP_BAR_REVEAL_THRESHOLD = 0.995;

export const LOADING_WORD_INTERVAL_MS = 750;
export const LOADING_WORD_FADE_MS = 200;

export const SHIMMER_COOLDOWN_MS = 350;
export const COMBAT_TEXT_LIFETIME_MS = 3300;
export const COMBAT_TEXT_LANE_DELAY_MS = 80;
export const COMBAT_TEXT_MAX_VISIBLE_PER_RAIL = 3;
export const CARD_ACTIVATION_ROTATION_DEGREES = 4.2;

export const COMBATANT_STATUS_EFFECT_PHASE_MS = 4000;

export const COMBATANT_STATUS_ORBIT_RADIUS = 0.42;

export const COMBATANT_STATUS_STAR_COUNT = 8;

export const COMBATANT_FREEZE_ENCROACH_PROGRESS = 0.35;

export const COMBATANT_STATUS_FROST_OPACITY = 0.75;

export const COMBATANT_STATUS_FLAKE_COUNT = 12;

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

export const GHOST_TRAVEL_SCALE = 0.74;
export const GHOST_PLAYER_OFFSET_RATIO = 0.16;
export const GHOST_TARGET_Y_RATIO = 0.82;
export const GHOST_FALLBACK_WIDTH_PX = 160;
export const GHOST_FALLBACK_HEIGHT_PX = 220;
export const GHOST_FALLBACK_CENTER_Y_RATIO = 0.3;
export const BATTLE_PARTICLE_COUNT = 80;
export const BATTLE_PARTICLE_INTENSITY_NORMAL = 2.0;
export const BATTLE_PARTICLE_INTENSITY_BOSS = 2.9;
export const STAGE_HEIGHT = 1080;

export const COLLECTION_PAGE_SIZE = 8;
export const BESTIARY_PAGE_SIZE = 6;
export const TRINKET_PAGE_SIZE = 8;
export const BATTLE_ACTOR_TOP = "34%";
export const HAND_FAN_VERTICAL_STEP_PX = 10;
export const HAND_FAN_ROTATION_DEGREES = 4.2;
export const HAND_REST_DROP_PX = 12;
export const HAND_HOVER_LIFT_PX = 26;
export const HAND_HOVER_ROTATION_DEGREES = 2.6;

export const HAND_HOVER_TOOLTIP_PADDING_PX = 16;

export const HAND_HOVER_HANDOFF_MS = 50;

export const HAND_REFLOW_MOTION_MS = 320;
export const HAND_CARD_BASE_Z_INDEX = 10;
export const HAND_CARD_HOVER_Z_INDEX = 40;

export const WISH_OVERLAY_Z_INDEX = 90;

export const BUTTON_HOVER_TRANSITION = "transition-[background-color,box-shadow] duration-150";
export const BUTTON_HOVER_PRIMARY = "button-primary-bloom";
export const BUTTON_HOVER_DESTRUCTIVE = "hover:bg-destructive/90";
export const BUTTON_HOVER_SECONDARY = "hover:bg-muted/80";
