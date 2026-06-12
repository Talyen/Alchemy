// ============ Combat Constants ============
// All tuning values centralized here so balance changes don't require hunting
// through game-logic code. These are imported by battle/effects.ts and battle/turns.ts.

export const GLOBAL_CRIT_CHANCE = 5;
export const CRIT_MULTIPLIER = 2;
export const BLEED_STATUS_MULTIPLIER = 2; // Bleed stacks gain 2× damage dealt (burst DoT vs burn/poison sustain).
export const STUN_THRESHOLD_FRACTION = 0.5; // Stun when stacks exceed this fraction of current enemy Health.
export const FREEZE_THRESHOLD_FRACTION = 0.5; // Freeze uses >= vs stun's > (equivalent at integer Health).
export const WISH_CHOICE_COUNT = 3;
export const MIN_MAX_MANA_FLOOR = 1; // Prevents 0 maxMana softlock.

// ============ Battle / Rooms ============
export const ROOM_SCALING_INCREMENT = 0.07; // +7% enemy HP/attack per room (multiplicative).
export const ELITE_HP_MULTIPLIER = 1.3;
export const STARTING_TURN = 1;
export const ENEMY_BASE_REGENERATION = 1;
export const ENEMY_BOSS_REGENERATION = 1;
export const BLEED_EXECUTE_MULTIPLIER = 2;
export const FREE_CARD_SENTINEL = 99; // nextCardCostReduction value that guarantees a card costs 0.
export const PERCENT_DENOMINATOR = 100;
export const HALF_DIVISOR = 2;
const LEECH_HEAL_FRACTION = 0.5;

/** Leech keyword: heal for half the triggering damage (rounded). */
export function computeLeechHeal(damageDealt: number): number {
  if (damageDealt <= 0) return 0;
  return Math.round(damageDealt * LEECH_HEAL_FRACTION);
}
export const FIRST_EFFECT_MULTIPLIER = 2;
/** Wildfire talent: first burn card each combat deals 50% more (not a full double). */
export const FIRST_BURN_CARD_BONUS_MULTIPLIER = 1.5;
/** Flaming Shield / Impact Guard: bonus damage from block as a percent of current block. */
export const BLOCK_SCALED_DAMAGE_PERCENT = 30;
/** Manaburn talent: burn bonus from max mana as a percent of Mana Crystals. */
export const MANA_BURN_DAMAGE_PERCENT = 35;
export const GOLD_TROVE_REWARD_MULTIPLIER = 2;

// ============ Battle Tuning ============
export const CARDS_PER_TURN = 4; // Drawn each turn after hand is discarded; overflow draws are skipped (not discarded).
export const MAX_HAND_SIZE = 7;
export const MAX_PLAYER_HEALTH = 30;
export const MAX_HEALTH_PER_TALENT_POINT = 1;
export const BASE_ENEMY_HEALTH = 30;
export const BASE_PLAYER_MANA = 4;
export const DEFAULT_BATTLE_ENEMY_TYPE = "normal";

// ============ Animation Flag ============
// Set localStorage["alchemy-disable-animations"]="true" before page load to collapse
// all CSS animation durations and JS setTimeout delays to near-zero. Intended for e2e
// tests that verify battle logic, not visual polish. Safe because it only accelerates
// cosmetic sequencing — no effect on combat math, card effects, or state transitions.
// Avoid using it for tests that verify layout, visual state, or animation-specific
// behaviour (draw/discard animation counts, stagger timing, screen transitions).
export function isAnimationDisabled(): boolean {
  if (typeof localStorage !== "undefined") {
    const val = localStorage.getItem("alchemy-disable-animations");
    return val === "true";
  }
  return false;
}
export const ANIMATION_DISABLED_DURATION = 1;

// ============ Timing (ms) ============
export const AUTO_END_TURN_DELAY = 1220;
export const VICTORY_TRANSITION_DELAY = 1200;
export const ENEMY_PHASE_DELAY = 900;
export const ENEMY_ATTACK_RECOVERY_DELAY = 500;
export const SHAKE_DURATION = 420;
export const HURT_FLASH_DURATION_MS = 280;
export const HURT_SPARK_DURATION_MS = 450;
export const HURT_SPARK_COUNT = 32;
export const COMPANION_ATTACK_DELAY = 1000;
export const NAVIGATION_DELAY_MS = 100;
export const CAMPFIRE_ANIMATION_MS = 900;
export const CAMPFIRE_CONTINUE_DELAY = 400;

// ============ Campfire ============
export const CAMPFIRE_HEAL_FRACTION = 0.3; // Restores 30% of max Health — meaningful but not full recovery.

// ============ Talents / XP ============
export const XP_BASE_PER_POINT = 10; // Point n costs n×10 XP (triangular total).
export const XP_TRIANGULAR_MULTIPLIER = 5; // Total XP for n points: n(n+1)/2 × 5.
export const XP_MIN_THRESHOLD = 10;
export const XP_ROOT_DIVISOR = 0.8; // Inverse formula: sqrt(1 + 0.8×XP).
export const TALENT_CHOICES_OFFERED = 1;
export const TALENT_UNLOCK_ANIMATION_MS = 620;
export const TALENT_UNLOCK_SETTLE_MS = 400;

// ============ Shop ============
export const SHOP_CARD_PRICE = 30;
export const SHOP_REMOVE_PRICE = 50;
export const SHOP_REFRESH_PRICE = 20;

// ============ Alchemist's Shop ============
export const ALCHEMIST_POTION_PRICE = 20;
export const ALCHEMIST_REFRESH_PRICE = 20;
export const ALCHEMIST_MIX_PRICE = 40;

// ============ Draft ============
export const DRAFT_ROUNDS = 6;
export const DRAFT_CHOICES = 3;

// ============ Rewards ============
export const GOLD_REWARD_MIN = 10;
export const GOLD_REWARD_MAX = 30;
export const ELITE_GOLD_BONUS_FRACTION = 0.3;
export const BOSS_GOLD_BONUS_FRACTION = 0.5;
export const REWARD_CARD_CHOICES = 3;
export const REWARD_TRINKET_CHANCE = 0.25;
export const REWARD_RANDOM_CHANCE = 0.5;
export const DESTINATION_CHOICES = 3;
export const DEFAULT_DESTINATION_WEIGHT = 10;
// Semantic alias: corruption uses the same weight as normal routes; separate name documents intent at call sites.
export const CORRUPTION_DESTINATION_WEIGHT = 10;
export const PREVIOUS_DESTINATION_WEIGHT = 1; // Down-weights the room type the player just visited.
export const CORRUPTION_MUTATION_DELTA = 1;
export const CORRUPTION_MIN_VALUE = 0;
export const DESTINATIONS_PER_ACT = 8; // Slot 8 is the boss.
export const ACTS_PER_RUN = 3;
export const DEFAULT_CAMPAIGN_DIFFICULTY_ID = "difficulty-1";
export const SHOP_MIN_GOLD = 40;
export const CAMPFIRE_HEALTH_THRESHOLD = 0.8;
export const ELITE_HEALTH_THRESHOLD = 0.5;
export const SHOP_CARDS_OFFERED = 3;
export const SHOP_REFRESHES = 1;
export const ALCHEMIST_POTIONS_OFFERED = 3;
export const ALCHEMIST_REFRESHES = 1;
export const BOSS_HEALTH_MULTIPLIER = 1.4;
export const BOSS_TRINKET_REWARD_CHOICES = 3;
export const ELITE_TRINKET_REWARD_CHANCE = 0.75;
export const MYSTERY_CARD_CHOICES = 3;
export const MIXED_POTION_CARD_ID = "mixed-potion";
export const POTION_CARD_ID_SUFFIX = "-potion";
export const MIXED_POTION_TITLE = "Mixed Potion";
export const MIXED_POTION_COST = 1;
export const CONSUME_DESCRIPTION_LINE = "Consume";

export const LABYRINTH_REWARD_CONFIG = {
  generousGoldBonusFraction: 0.5,
  scavengerMaterialMultiplier: 2,
  companionCardChoices: 3,
  trinketHoarderRewardChanceBonus: 0.1,
} as const;

export const REWARD_SELECTION_CONFIG = {
  newCardScoreBonus: 2,
  affinityPoolMultiplier: 2,
} as const;

// ============ Audio ============
export const MASTER_GAIN = 0.3;
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

// ============ SFX Cooldown ============
export const SFX_COOLDOWN_MS = 80;

// ============ Image / Asset Preloading ============
export const IMAGE_PRELOAD_BATCH_SIZE = 4;
export const IMAGE_PRELOAD_IDLE_TIMEOUT = 900;

// ============ Screen Transitions ============
export const PAGE_EXIT_MS = 130;

// ============ Startup Loading ============
export const INITIAL_LOAD_MIN_DURATION_MS = 650;
export const INITIAL_LOAD_MAX_DURATION_MS = 12000;
export const INITIAL_LOAD_BATCH_SIZE = 4;

// ============ Animation / Timing ============
export const SHIMMER_COOLDOWN_MS = 500;
export const COMBAT_TEXT_LIFETIME_MS = 3300;
export const COMBAT_TEXT_LANE_DELAY_MS = 80;
export const ANIMATION_STAGGER_UNIT = 0.08;
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
export const TRINKET_PAGE_SIZE = 6;
export const SELECTION_GRID_PAGE_SIZE = 8;
export const BATTLE_ACTOR_TOP = "34%";
export const HAND_FAN_VERTICAL_STEP_PX = 10;
export const HAND_FAN_ROTATION_DEGREES = 4.2;
export const HAND_HOVER_LIFT_PX = 34;
export const HAND_HOVER_ROTATION_DEGREES = 2.6;
export const HAND_HOVER_SCALE = 1.03;
export const HAND_CARD_BASE_Z_INDEX = 10;
export const HAND_CARD_HOVER_Z_INDEX = 40;
/** Battle wish overlay and flying card transfer layer — keep in sync with `--z-wish-overlay` in index.css. */
export const WISH_OVERLAY_Z_INDEX = 90;

// ============ Storage ============
export const SAVE_KEY = "alchemy-save-v1";

// Default UI slider values (0–100 scale). Used by both defaults.ts (first-boot state) and
// save-schemas.ts (.catch() fallbacks for corrupt saves) so the two always agree.
export const DEFAULT_MUSIC_VOLUME_PCT = 50;
export const DEFAULT_SFX_VOLUME_PCT = 50;
export const DEFAULT_MASTER_VOLUME_PCT = 50;
export const DEFAULT_BRIGHTNESS_PCT = 100;

// The original Knight starter deck IDs from save schema v0. Stored here rather than inside
// each validator so active-run.ts and save-schemas.ts share a single source of truth.
export const LEGACY_STARTER_DECK_IDS = [
  "slash",
  "bash",
  "block",
  "anvil",
  "plate-mail",
  "apple",
  "meteor",
  "blessed-aegis",
] as const;

// Legacy character renames to support saves from before IDs were aligned with data files.
export const LEGACY_CHARACTER_RENAMES = {
  sorcerer: "wizard",
  warden: "ranger",
} as const;

// ============ Enemy Trait Tuning ============
export const TRAIT_FORGE_PER_TURN = 1;
export const IRON_HIDE_ARMOR_PER_TURN = 1;
export const TRAIT_FREEZE_BONUS_PER_TURN = 1;
export const IRON_HIDE_BURN_BONUS_PER_TURN = 1;
export const DIFFICULTY_FORGE_PER_TURN = 1;
export const LIVING_ARMOR_STARTING_ARMOR = 5;
export const ENEMY_STARTING_BLOCK = 4;

// ============ Labyrinth ============
export const LABYRINTH_STURDY_MULTIPLIER = 1.3;
export const LABYRINTH_STURDY_HEALTH_PCT = 30;
export const LABYRINTH_BURNING_GROUND_DAMAGE = 2;
export const LABYRINTH_LEECH_HEAL = 3;
export const LABYRINTH_MIN_CONNECTIONS = 1;
export const LABYRINTH_MAX_CONNECTIONS = 3;
export const LABYRINTH_MAP_UI = {
  lineTrimOffset: 3.35,
  tooltipPadding: 8,
  mapGutter: 4.5,
  shineDuration: 10,
  shineBorderWidth: 2,
} as const;
export const FALLBACK_ENEMY_ATTACK = 8;

// ============ Enemy Trait Damage Modifiers ============
export const TRAIT_DAMAGE_WEAKNESS = 2;
const TRAIT_DAMAGE_RESISTANCE = 0.5;

// ============ Wish ============
export const WISH_CRYSTAL_GOLD_CHANCE = 0.5;

// ============ Battle Core Rules ============
export const BATTLE_CONFIG = {
  CC_IMMUNITY_DURATION: 2, // Turns of status immunity after Stun/Freeze wears off.
  BASE_CC_DURATION: 1,
  ARMOR_DECAY_AMOUNT: 1, // Armor lost when taking health damage.
  FORGE_DECAY_AMOUNT: 1, // Forge consumed when playing physical attacks.
} as const;

// ============ Status Tick Tuning ============
/** Poison stacks lost after each tick: max(1, round(stacks * percent / 100)). */
export const POISON_DECAY_PERCENT = 20;
export const POISON_GAIN_AMOUNT = 1;

export const STATUS_CONFIG = {
  MIN_STACK_AMOUNT: 1,
  CC_NOTICE_STUN: "Stunned",
  CC_NOTICE_FREEZE: "Frozen",
} as const;

// ============ Enemy Trait IDs (status/damage lookups) ============
export const ENEMY_TRAIT_IDS = {
  BRITTLE_BONES: "brittle-bones",
  TRINKET_HOARDER: "trinket-hoarder",
  HOLY_VULNERABILITY: "holy-vulnerability",
  BURN_RESISTANCE: "burn-resistance",
  BURN_VULNERABILITY: "burn-vulnerability",
  LIVING_ARMOR: "living-armor",
  THICK_HIDE: "thick-hide",
  POISON_RESISTANCE: "poison-resistance",
  GLACIAL_SHELL: "glacial-shell",
  GOLD_TROVE: "gold-trove",
  STARTING_BLOCK: "starting-block",
} as const;

// Trait damage rules: first matching (traitId, damageType) wins.
export const TRAIT_DAMAGE_RULES: { traitId: string; damageType: string; multiplier: number }[] = [
  { traitId: ENEMY_TRAIT_IDS.BRITTLE_BONES, damageType: "holy", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.BRITTLE_BONES, damageType: "stun", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.TRINKET_HOARDER, damageType: "burn", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.HOLY_VULNERABILITY, damageType: "holy", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.BURN_RESISTANCE, damageType: "burn", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.BURN_VULNERABILITY, damageType: "burn", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.LIVING_ARMOR, damageType: "bleed", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.THICK_HIDE, damageType: "physical", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.POISON_RESISTANCE, damageType: "poison", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.GLACIAL_SHELL, damageType: "freeze", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.GLACIAL_SHELL, damageType: "burn", multiplier: TRAIT_DAMAGE_WEAKNESS },
];

// ============ Companion ============
export const COMPANION_GOLD_FIND_CHANCE = 0.5;
export const COMPANION_GOLD_MULTIPLIER = 1.2;
export const COMPANION_SOUND_CARD_IDS: Record<string, string> = {
  wolf: "wolf-companion",
  imp: "imp-companion",
  "lizard-scout": "lizard-scout-companion",
};

// ============ Corruption ============
export const CORRUPTION_TRANSFORM_CHANCE = 0.5;
export const CORRUPTION_DELTA_CHANCE = 0.2; // P(nerf): 20%; otherwise corruption buffs (+1).
export const CORRUPTION_TEXT_PATTERNS = {
  authoredNumber: /\d+/g,
  leadingNumber: /^\d+/,
} as const;

// ============ Homestead Loot ============
export const HOMESTEAD_LOOT_CONFIG = {
  enemyTypeMultipliers: {
    normal: 1,
    elite: 1.3,
    boss: 3,
  },
} as const;

export const MUSIC_KEYS = {
  MENU: "menu",
  BATTLE: "battle",
} as const;
