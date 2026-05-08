// ============ Combat Constants ============
// All tuning values centralized here so balance changes don't require hunting
// through game-logic code. These are imported by battle/effects.ts and battle/turns.ts.

export const GLOBAL_CRIT_CHANCE = 5;          // 5% base crit for ALL damage types. Keeps fights unpredictable without making crits the primary strategy.
export const CRIT_MULTIPLIER = 2;             // Crits double damage. 2x is the industry standard — feels satisfying without being game-breaking.
export const BLEED_STATUS_MULTIPLIER = 2;     // Bleed adds DOUBLE the damage dealt to its status stack. This makes bleed the highest-potential DoT (burst on tick) vs burn/poison's sustained damage.
export const STUN_THRESHOLD_FRACTION = 0.5;   // Stun procs when accumulated >50% of current enemy HP. Uses current (post-damage) HP so it's harder to stun healthy enemies.
export const FREEZE_THRESHOLD_FRACTION = 0.5; // Freeze same as stun but uses >= instead of > (identical in practice due to integer HP).
export const WISH_CHOICE_COUNT = 3;           // Wish offers 3 cards from the full library. 3 is the "rule of three" for meaningful choice without option paralysis.
export const MIN_MAX_MANA_FLOOR = 1;          // Minimum maxMana after reductions. Prevents softlock — with 0 max mana no card can ever be played.

// ============ Battle / Rooms ============
export const ROOM_SCALING_INCREMENT = 0.1;     // +10% enemy HP/attack per room (multiplicative)
export const ELITE_STAT_MULTIPLIER = 1.3;       // Elite enemies get 30% more HP and attack
export const STARTING_TURN = 1;                 // Turn counter starts at 1 for readability.
export const ENEMY_HEAL_FRACTION = 0.1;         // Enemy heals 10% of max HP when below 50% HP.
export const ENEMY_BASE_REGENERATION = 2;       // Base enemy regeneration per turn (scaled by room).
export const BLEED_EXECUTE_MULTIPLIER = 2;      // Bleed damage multiplier when enemy is below execute threshold.
export const FREE_CARD_SENTINEL = 99;           // nextCardCostReduction value that guarantees a card costs 0.

// ============ Timing (ms) ============
export const AUTO_END_TURN_DELAY = 1220;       // How long the system waits before auto-ending turn when conditions are met (no mana, no cards).
export const VICTORY_TRANSITION_DELAY = 1200;  // Brief pause after enemy dies so the death animation can play before the victory screen.
export const ENEMY_PHASE_DELAY = 900;          // Gap between enemy turn start and enemy action. Short enough to keep turns snappy while still readable.
export const SHAKE_DURATION = 420;             // Screen shake on hit. 420ms is long enough to feel impactful but short enough to not delay gameplay.
export const COMPANION_ATTACK_DELAY = 1000;    // Delay before companion attacks at start of player turn.
export const CAMPFIRE_ANIMATION_MS = 1250;     // HP bar animation duration. Long enough to feel satisfying, short enough to not bore.
export const CAMPFIRE_CONTINUE_DELAY = 600;    // Brief pause after animation completes before auto-advancing. Gives player time to register the new HP value.

// ============ Campfire ============
export const CAMPFIRE_HEAL_FRACTION = 0.3;     // Restores 30% of max HP. High enough to be meaningful, low enough that you still need to play well.

// ============ Talents / XP ============
export const XP_BASE_PER_POINT = 10;           // First talent point costs 10 XP. Subsequent points cost (n+1)*10 (20, 30, 40…).
export const XP_TRIANGULAR_MULTIPLIER = 5;     // Used in the triangular number formula: n(n+1)/2 * 5 = total XP for n points.
export const XP_MIN_THRESHOLD = 10;            // XP floor before any talent point is earned. Prevents fractional points at very low XP.
export const XP_ROOT_DIVISOR = 0.8;            // Constant in the inverse triangular formula: sqrt(1 + 0.8*XP). Derived from 2/XP_BASE_PER_POINT.
export const TALENT_CHOICES_OFFERED = 1;       // Number of random talent options presented when spending a point. Now 1 — click to unlock instantly.

// ============ Shop ============
export const SHOP_CARD_PRICE = 30;
export const SHOP_REMOVE_PRICE = 50;
export const SHOP_REFRESH_PRICE = 20;

// ============ Alchemist's Shop ============
export const ALCHEMIST_POTION_PRICE = 20;    // each potion costs 20g
export const ALCHEMIST_REFRESH_PRICE = 20;   // refresh rerolls the 3 potion options
export const ALCHEMIST_MIX_PRICE = 40;       // combine 2 potions from deck

// ============ Rewards ============
export const GOLD_REWARD_MIN = 10;
export const GOLD_REWARD_MAX = 30;             // Gold range per victory. ~20 average means you can afford a mid-tier shop item every ~3 fights.
export const REWARD_CARD_CHOICES = 3;          // Card rewards offered after each victory.
export const DESTINATION_CHOICES = 3;          // Path choices offered after each victory.

// ============ Audio ============
export const MASTER_GAIN = 0.3;                 // Master volume level. 0.3 prevents ear fatigue during extended sessions.
export const DEFAULT_MUSIC_VOLUME = 0.0875;     // Music baseline — reduced so it sits under SFX without overpowering.
export const MUSIC_BASE_PATH = "Music/";        // Relative path from BASE_URL for music files.

// ============ Animation / Timing ============
export const SHIMMER_DURATION_MS = 1250;        // Card shimmer sweep animation runtime.
export const SHIMMER_COOLDOWN_MS = 2600;        // Minimum time between shimmer triggers. Prevents rapid-fire re-triggers from spamming hover.
export const SHIMMER_INTRO_DELAY_MS = 500;      // Delay before first shimmer when entering a screen.
export const COMBAT_TEXT_LIFETIME_MS = 3300;     // How long floating combat text stays mounted; visual fade is slightly shorter so cleanup never clips it.
export const COMBAT_TEXT_LANE_DELAY_MS = 80;     // Stagger between multi-line combat text entries (creates a stacking effect).
export const GHOST_EXTRA_BUFFER_MS = 90;        // Extra buffer on ghost animation cleanup. Prevents visual flicker at animation end.

// ============ Drag ============
export const DRAG_START_THRESHOLD_PX = 10;       // Pixels of movement before a click becomes a drag. 10px prevents accidental drags on click.
export const DRAG_ROTATION_CLAMP = 12;           // Max drag preview rotation in degrees.
export const DRAG_ROTATION_DIVISOR = 18;         // Rotation sensitivity divisor (higher = less rotation per pixel).

// ============ Layout ============
export const GHOST_TRAVEL_SCALE = 0.74;          // Scale factor for card ghost when traveling between zones.
export const BATTLEFIELD_HIT_FRACTION = 0.74;    // Fraction of battle scene height used for drag-to-play hit detection.
export const PLAYER_PANEL_OFFSET_FRACTION = 0.16;

// ============ Collection ============
export const COLLECTION_PAGE_SIZE = 10;          // Items per page in the collection compendium.

// ============ Storage ============
export const SAVE_KEY = "alchemy-save-v1";       // localStorage key. Version suffix enables migration if shape changes.

// ============ Named string enums ============
// String constants to prevent typos in state machine transitions and event dispatch.
export const SCREENS = {
  MENU: "menu",
  CHARACTER_SELECT: "character-select",
  BATTLE: "battle",
  REWARDS: "rewards",
  DESTINATION: "destination",
  CAMPFIRE: "campfire",
  GAME_OVER: "game-over",
  COLLECTION: "collection",
  OPTIONS: "options",
  TALENTS: "talents",
} as const;

export const MUSIC_KEYS = {
  MENU: "menu",
  BATTLE: "battle",
} as const;
