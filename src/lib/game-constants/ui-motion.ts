export const IMAGE_PRELOAD_BATCH_SIZE = 4;
export const IMAGE_PRELOAD_TIMEOUT_MS = 15_000;

export const MOTION_FADE_MS = 180;
export const TOOLTIP_FADE_MS = 120;

export const NAVIGATION_DELAY_MS = 100;
export const CAMPFIRE_ANIMATION_MS = 1200;

export const INITIAL_LOAD_MIN_DURATION_MS = 5000;
export const FONT_PRELOAD_TIMEOUT_MS = 10_000;
export const STARTUP_LOAD_IMAGE_WEIGHT = 0.85;
export const STARTUP_LOAD_FONT_WEIGHT = 0.05;
export const STARTUP_LOAD_BOOTSTRAP_WEIGHT = 0.1;
export const STARTUP_BAR_INCOMPLETE_CAP = 0.92;
export const STARTUP_BAR_TAU_MS = 220;
export const STARTUP_BAR_TRICKLE_PER_SEC = 0.04;
export const STARTUP_BAR_REVEAL_THRESHOLD = 0.995;

export const SHIMMER_COOLDOWN_MS = 350;
export const COMBAT_TEXT_MERGE_WINDOW_MS = 250;
export const COMBAT_RECOIL_COOLDOWN_MS = 180;
export const COMBAT_DODGE_DURATION_MS = 460;
export const COMBAT_IMPACT_NORMAL_HEALTH_RATIO = 0.05;
export const COMBAT_IMPACT_HEAVY_HEALTH_RATIO = 0.2;
export const CARD_REJECTION_FEEDBACK_MS = 260;
export const COMBAT_TEXT_LIFETIME_MS = 1050;
export const COMBAT_TEXT_MIN_LIFETIME_MS = 400;
export const COMBAT_TEXT_BASE_SIZE_PX = 38.4;
export const COMBAT_TEXT_MOTION = {
  initialScale: 0.9,
  peakScale: 1.85,
  holdScale: 1.55,
  finalScale: 1.2,
  popMs: 85,
  settleMs: 85,
  riseStartMs: 240,
  riseMs: 810,
  risePx: 76,
  reactionOffsetPx: 0,
  reactionRisePx: 24,
  shrinkMs: 760,
  fadeMs: 280,
  statusSize: 0.8,
  reactionSize: 1.25,
  minimumLaunchGapMs: 80,
  maximumQueueDelayMs: 180,
  nearbyLaunchWindowMs: 360,
  fanStartPx: 16,
  fanDriftPx: 20,
  fanMs: 400,
  reactionRowPx: 32,
  impactRowPx: 24,
  statusRowPx: 24,
  clearancePx: 6,
  sampleMs: 15,
} as const;
export const REACTION_TEXT_LIFETIME_MS = 1600;
export const CARD_ACTIVATION_ROTATION_DEGREES = 4.2;

export const COMBATANT_STATUS_EFFECT_PHASE_MS = 4000;

export const COMBATANT_STATUS_ORBIT_RADIUS = 0.42;

export const COMBATANT_STATUS_STAR_COUNT = 8;

export const COMBATANT_FREEZE_ENCROACH_PROGRESS = 0.35;

export const COMBATANT_STATUS_FROST_OPACITY = 0.75;

export const COMBATANT_STATUS_FLAKE_COUNT = 12;

export const CARD_TRANSFER_CONFIG = {
  drawDurationSec: 0.5,
  discardDurationSec: 0.5,
  batchSpeedMultipliers: { small: 1, medium: 1.4, large: 1.6, mediumCardCount: 3, smallMaxCardCount: 2 },
  drawFlipTimes: [0.28, 0.82],
  discardFlipTimes: [0.4, 0.95],
  completionBufferMs: 120,
  requiredStableSlotFrames: 2,
  maxSlotStabilizeFrames: 12,
  soundVolume: 0.4,
  stableRectTimeoutMs: 2000,
  rectEpsilonPx: 0.5,
  arcRatio: 0.1,
} as const;

export const GHOST_TRAVEL_SCALE = 0.74;
export const GHOST_TARGET_Y_RATIO = 0.95;
export const GHOST_FALLBACK_WIDTH_PX = 160;
export const GHOST_FALLBACK_HEIGHT_PX = 220;
export const GHOST_FALLBACK_CENTER_Y_RATIO = 0.3;
export const BATTLE_PARTICLE_COUNT = 80;
export const BATTLE_PARTICLE_INTENSITY_NORMAL = 2.0;
export const BATTLE_PARTICLE_INTENSITY_BOSS = 2.9;

export const HAND_FAN_VERTICAL_STEP_PX = 10;
export const HAND_FAN_ROTATION_DEGREES = 4.2;
export const HAND_REST_DROP_PX = 12;
export const HAND_HOVER_LIFT_PX = 26;
export const HAND_HOVER_ROTATION_DEGREES = 2.6;

export const HAND_HOVER_TOOLTIP_PADDING_PX = 16;

export const HAND_REFLOW_MOTION_MS = 320;
export const HAND_CARD_BASE_Z_INDEX = 10;
export const HAND_CARD_HOVER_Z_INDEX = 40;
export const CARD_FLIGHT_Z_INDEX = 120;

export const WISH_OVERLAY_Z_INDEX = 90;

export const HOMESTEAD_FEEDBACK = {
  valueMs: 180,
  resizeMs: 180,
  starMs: 360,
  tooltipPopMs: 360,
  revealMs: 400,
  glowMs: 450,
  feedbackMs: 500,
} as const;
