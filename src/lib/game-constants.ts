// ============ Combat Constants ============
// All tuning values centralized here so balance changes don't require hunting
// through game-logic code. These are imported by battle/effects.ts and battle/turns.ts.

export const GLOBAL_CRIT_CHANCE = 5; // 5% base crit for ALL damage types. Keeps fights unpredictable without making crits the primary strategy.
export const CRIT_MULTIPLIER = 2; // Crits double damage. 2x is the industry standard — feels satisfying without being game-breaking.
export const BLEED_STATUS_MULTIPLIER = 2; // Bleed adds DOUBLE the damage dealt to its status stack. This makes bleed the highest-potential DoT (burst on tick) vs burn/poison's sustained damage.
export const STUN_THRESHOLD_FRACTION = 0.5; // Stun procs when accumulated >50% of current enemy HP. Uses current (post-damage) HP so it's harder to stun healthy enemies.
export const FREEZE_THRESHOLD_FRACTION = 0.5; // Freeze same as stun but uses >= instead of > (identical in practice due to integer HP).
export const WISH_CHOICE_COUNT = 3; // Wish offers 3 cards from the full library. 3 is the "rule of three" for meaningful choice without option paralysis.
export const MIN_MAX_MANA_FLOOR = 1; // Minimum maxMana after reductions. Prevents softlock — with 0 max mana no card can ever be played.

// ============ Battle / Rooms ============
export const ROOM_SCALING_INCREMENT = 0.1; // +10% enemy HP/attack per room (multiplicative)
export const ELITE_STAT_MULTIPLIER = 1.3; // Elite enemies get 30% more HP and attack
export const STARTING_TURN = 1; // Turn counter starts at 1 for readability.
export const ENEMY_HEAL_FRACTION = 0.1; // Enemy heals 10% of max HP when below 50% HP.
export const ENEMY_BASE_REGENERATION = 2; // Base enemy regeneration per turn (scaled by room).
export const ENEMY_BOSS_REGENERATION = 4; // Base regen for regeneration-trait bosses.
export const BLEED_EXECUTE_MULTIPLIER = 2; // Bleed damage multiplier when enemy is below execute threshold.
export const FREE_CARD_SENTINEL = 99; // nextCardCostReduction value that guarantees a card costs 0.
export const PERCENT_DENOMINATOR = 100; // Percent-based talent and trait values use 0-100 authoring.
export const HALF_DIVISOR = 2; // Shared halving divisor for decay and below-half thresholds.
export const FIRST_EFFECT_MULTIPLIER = 2; // First-card double effects intentionally share a 2x multiplier.
export const GOLD_TROVE_DAMAGE_REWARD = 1; // Mimic trait gold gained each time it takes damage.

// ============ Battle Tuning ============
export const CARDS_PER_TURN = 4; // Cards drawn at turn start. Tuned to Knight starter deck (8 cards, ~8 turns avg).
export const MAX_HAND_SIZE = 7; // Hand size cap; excess draws are skipped.
export const MAX_PLAYER_HEALTH = 30; // Starting and default max HP for all characters.
export const BASE_ENEMY_HEALTH = 30; // Base enemy HP before room/act/type scaling.
export const BASE_PLAYER_MANA = 4; // Starting and max mana per turn.

// ============ Timing (ms) ============
export const AUTO_END_TURN_DELAY = 1220; // How long the system waits before auto-ending turn when conditions are met (no mana, no cards).
export const VICTORY_TRANSITION_DELAY = 1200; // Brief pause after enemy dies so the death animation can play before the victory screen.
export const ENEMY_PHASE_DELAY = 900; // Gap between enemy turn start and enemy action. Short enough to keep turns snappy while still readable.
export const SHAKE_DURATION = 420; // Screen shake on hit. 420ms is long enough to feel impactful but short enough to not delay gameplay.
export const COMPANION_ATTACK_DELAY = 1000; // Delay before companion attacks at start of player turn.
export const NAVIGATION_DELAY_MS = 100; // Short delay lets page exit transitions begin before the next screen mounts.
export const CAMPFIRE_ANIMATION_MS = 1250; // HP bar animation duration. Long enough to feel satisfying, short enough to not bore.
export const CAMPFIRE_CONTINUE_DELAY = 600; // Brief pause after animation completes before auto-advancing. Gives player time to register the new HP value.

// ============ Campfire ============
export const CAMPFIRE_HEAL_FRACTION = 0.3; // Restores 30% of max HP. High enough to be meaningful, low enough that you still need to play well.

// ============ Talents / XP ============
export const XP_BASE_PER_POINT = 10; // First talent point costs 10 XP. Subsequent points cost (n+1)*10 (20, 30, 40…).
export const XP_TRIANGULAR_MULTIPLIER = 5; // Used in the triangular number formula: n(n+1)/2 * 5 = total XP for n points.
export const XP_MIN_THRESHOLD = 10; // XP floor before any talent point is earned. Prevents fractional points at very low XP.
export const XP_ROOT_DIVISOR = 0.8; // Constant in the inverse triangular formula: sqrt(1 + 0.8*XP). Derived from 2/XP_BASE_PER_POINT.
export const TALENT_CHOICES_OFFERED = 1; // Number of random talent options presented when spending a point. Now 1 — click to unlock instantly.

// ============ Shop ============
export const SHOP_CARD_PRICE = 30;
export const SHOP_REMOVE_PRICE = 50;
export const SHOP_REFRESH_PRICE = 20;

// ============ Alchemist's Shop ============
export const ALCHEMIST_POTION_PRICE = 20; // each potion costs 20g
export const ALCHEMIST_REFRESH_PRICE = 20; // refresh rerolls the 3 potion options
export const ALCHEMIST_MIX_PRICE = 40; // combine 2 potions from deck

// ============ Rewards ============
export const GOLD_REWARD_MIN = 10;
export const GOLD_REWARD_MAX = 30; // Gold range per victory. ~20 average means you can afford a mid-tier shop item every ~3 fights.
export const ELITE_GOLD_BONUS_FRACTION = 0.3; // Elite fights pay a modest bonus without eclipsing boss rewards.
export const BOSS_GOLD_BONUS_FRACTION = 0.5; // Boss fights pay a larger bonus to mark act completion.
export const REWARD_CARD_CHOICES = 3; // Card rewards offered after each victory.
export const DESTINATION_CHOICES = 3; // Path choices offered after each victory.
export const DEFAULT_DESTINATION_WEIGHT = 10; // Normal route choices use even weighting before rare-route modifiers.
export const CORRUPTION_DESTINATION_WEIGHT = DEFAULT_DESTINATION_WEIGHT; // Corruption appears like ordinary routes, but route flow prevents repeats.
export const CORRUPTION_MUTATION_DELTA = 1; // Corruption nudges one authored number up or down by exactly 1.
export const CORRUPTION_MIN_VALUE = 0; // Corruption can reduce values to 0, but never negative.
export const DESTINATIONS_PER_ACT = 8; // Number of destination slots per act (slot 8 = boss).
export const ACTS_PER_RUN = 3; // Number of acts in a full run.
export const SHOP_MIN_GOLD = 40; // Player needs at least this much gold to see shop destinations.
export const CAMPFIRE_HP_THRESHOLD = 0.8; // Skip campfire destination if HP >= 80% of max.
export const ELITE_HP_THRESHOLD = 0.5; // Skip elite combat destination if HP < 50% of max.
export const SHOP_CARDS_OFFERED = 3; // Cards displayed in the merchant shop.
export const SHOP_REFRESHES = 1; // Free refreshes per shop visit.
export const ALCHEMIST_POTIONS_OFFERED = 3; // Potions displayed in the alchemist shop.
export const ALCHEMIST_REFRESHES = 1; // Free refreshes per alchemist visit.
export const BOSS_HP_MULTIPLIER = 2.2; // Boss enemies get 120% more HP.
export const BOSS_ATTACK_MULTIPLIER = 1.8; // Boss enemies get 80% more attack.
export const ACT_SCALING_INCREMENT = 0.2; // +20% enemy stats per act (baseline).
export const BOSS_TRINKET_REWARD_CHOICES = 3; // Trinket choices offered after a boss kill.
export const ELITE_TRINKET_REWARD_CHANCE = 0.75; // Elite rewards strongly favor trinkets but still allow card rewards.
export const MYSTERY_CARD_CHOICES = 3; // Card-choice mystery events offer the same count as normal reward choices.
export const MIXED_POTION_CARD_ID = "mixed-potion"; // Generated alchemy card excluded from random permanent card rewards.
export const POTION_CARD_ID_FRAGMENT = "potion"; // Base potion cards share this ID fragment.
export const MIXED_POTION_TITLE = "Mixed Potion"; // Crafted alchemy card title shown in deck/reveal UI.
export const MIXED_POTION_COST = 1; // Crafted potions keep normal potion play cost.
export const CONSUME_DESCRIPTION_LINE = "Consume"; // Card text line used by consumable cards.

// ============ Audio ============
export const MASTER_GAIN = 0.3; // Master volume level. 0.3 prevents ear fatigue during extended sessions.
export const DEFAULT_MUSIC_VOLUME = 0.0875; // Music baseline — reduced so it sits under SFX without overpowering.
export const MUSIC_BASE_PATH = "Music/"; // Relative path from BASE_URL for music files.

// Music transition timing and gain staging. MUSIC_MASTER_GAIN is an additional layer
// on top of user music volume and master volume — the final volume is userMusic * master * MUSIC_MASTER_GAIN.
export const FADE_OUT_DURATION = 300; // ms — crossfade-out when switching tracks.
export const FADE_IN_DELAY = 600; // ms — silence before a new track fades in.
export const FADE_IN_DURATION = 1400; // ms — ramp time for incoming track to full volume.
export const MUSIC_MASTER_GAIN = 0.5; // Additional gain cap so music sits under SFX.

// ============ SFX Volume ============
export const DEFAULT_SFX_VOLUME = 0.35; // Initial SFX slider value.
export const SFX_UI_VOLUME = 0.6; // UI sounds play quieter to avoid competing with combat.
export const SFX_VICTORY_VOLUME = 0.8; // Victory stinger plays slightly louder.
export const SFX_DEFEAT_VOLUME = 0.7; // Defeat stinger plays at moderate volume.

// ============ Image / Asset Preloading ============
export const IMAGE_PRELOAD_BATCH_SIZE = 4; // How many speculative images to decode per idle callback.
export const IMAGE_PRELOAD_IDLE_TIMEOUT = 900; // ms — max deferral for idle callback scheduling.

// ============ Screen Transitions ============
export const PAGE_EXIT_MS = 130; // ms — exit animation duration before next screen mounts.

// ============ Startup Loading ============
export const INITIAL_LOAD_MIN_DURATION_MS = 650; // Minimum loading screen display time.
export const INITIAL_LOAD_MAX_DURATION_MS = 12000; // Hard cap — show the game even if assets are slow.

// ============ Animation / Timing ============
export const SHIMMER_DURATION_MS = 1250; // Card shimmer sweep animation runtime.
export const SHIMMER_COOLDOWN_MS = 2600; // Minimum time between shimmer triggers. Prevents rapid-fire re-triggers from spamming hover.
export const COMBAT_TEXT_LIFETIME_MS = 3300; // How long floating combat text stays mounted; visual fade is slightly shorter so cleanup never clips it.
export const COMBAT_TEXT_LANE_DELAY_MS = 80; // Stagger between multi-line combat text entries (creates a stacking effect).
export const ANIMATION_STAGGER_UNIT = 0.08; // Base delay step (80ms) between consecutive animated elements.
export const GHOST_DRAW_IN_MS = 520; // Duration of card ghost draw-from-deck animation.
export const GHOST_DISCARD_OUT_MS = 320; // Duration of card ghost discard-to-pile animation.
export const GHOST_ACTIVATE_MS = 672; // Duration of card ghost activation (play) animation.
export const GHOST_PLAY_TRAVEL_MS = 528; // Duration of card ghost travel-from-hand animation.
export const CARD_ACTIVATION_ROTATION_DEGREES = 4.2; // Fan angle applied while animating played cards from hand.

// ============ Drag ============
export const DRAG_START_THRESHOLD_PX = 10; // Pixels of movement before a click becomes a drag. 10px prevents accidental drags on click.
export const DRAG_ROTATION_CLAMP = 12; // Max drag preview rotation in degrees.

// ============ Layout ============
export const GHOST_TRAVEL_SCALE = 0.74; // Scale factor for card ghost when traveling between zones.
export const BATTLEFIELD_HIT_FRACTION = 0.74; // Fraction of battle scene height used for drag-to-play hit detection.
export const MOBILE_LANDSCAPE_MAX_WIDTH = 1024; // Coarse-pointer viewport width that still uses mobile landscape UI.
export const PORTRAIT_MOBILE_MAX_WIDTH = 768; // Coarse-pointer portrait width that shows rotate prompt.
export const ORIENTATION_CHANGE_DEBOUNCE_MS = 100; // Lets mobile browsers settle viewport dimensions after rotation.
export const DESIGN_STAGE_HEIGHT = 1080; // Desktop virtual canvas height used for consistent composition.
export const MOBILE_STAGE_HEIGHT = 900; // Mobile landscape virtual canvas height.
export const MIN_STAGE_SCALE = 0.3; // Lowered so small landscape phones still fit without overflow.
export const MAX_STAGE_SCALE = 1.35; // Upper bound prevents oversized UI on very large displays.

// ============ Collection ============
export const COLLECTION_PAGE_SIZE = 10; // Items per page in the collection compendium.
export const SELECTION_GRID_PAGE_SIZE = 8; // Items per page in deck selection grids (4 cols × 2 rows).
export const BATTLE_ACTOR_TOP_DESKTOP = "42%"; // Desktop vertical anchor for player/enemy cards.
export const BATTLE_ACTOR_TOP_MOBILE = "36%"; // Mobile landscape vertical anchor for player/enemy cards.
export const HAND_FAN_VERTICAL_STEP_PX = 10; // Per-card vertical offset for resting hand fan.
export const HAND_FAN_ROTATION_DEGREES = 4.2; // Per-card resting rotation for hand fan.
export const HAND_HOVER_LIFT_PX = 34; // Hovered cards lift out of the fan by this amount.
export const HAND_HOVER_ROTATION_DEGREES = 2.6; // Hover rotation keeps selected cards readable.
export const HAND_HOVER_SCALE = 1.03; // Slight scale-up for hovered hand cards.
export const HAND_CARD_BASE_Z_INDEX = 10; // Resting hand z-index start for overlap ordering.
export const HAND_CARD_HOVER_Z_INDEX = 40; // Hovered card z-index so popups stay above neighbors.
export const WISH_OVERLAY_Z_INDEX = 90; // Wish choices block all battle controls.

// ============ Storage ============
export const SAVE_KEY = "alchemy-save-v1"; // localStorage key. Version suffix enables migration if shape changes.

// ============ Enemy Trait Tuning ============
export const TRAIT_ARMOR_PER_TURN = 1; // Rusting-Carapace: armor gained each enemy turn.
export const TRAIT_FORGE_PER_TURN = 1; // Rusting-Carapace: forge gained each enemy turn.
export const IRON_HIDE_ARMOR_PER_TURN = 2; // Iron-Hide: armor gained each enemy turn.
export const FORGE_REGENERATION_PER_TURN = 2; // Forge-Regeneration: forge gained each enemy turn.
export const TRAIT_FREEZE_BONUS_PER_TURN = 1; // Glacial-Shell: freeze status bonus gained each turn.
export const DIFFICULTY_FORGE_PER_TURN = 1; // Difficulty modifier: forge gained each enemy turn.
export const LIVING_ARMOR_STARTING_ARMOR = 8; // Living-Armor trait initial armor value.

// ============ Labyrinth ============
export const LABYRINTH_STURDY_MULTIPLIER = 1.3; // Sturdy modifier: +30% enemy max HP (same as ELITE_STAT_MULTIPLIER).
export const LABYRINTH_BURNING_GROUND_DAMAGE = 2; // Burning Ground: 2 Burn to player each turn.
export const LABYRINTH_LEECH_HEAL = 3; // Leeching: enemy heals 3 HP on their turn.
export const FALLBACK_ENEMY_ATTACK = 8; // Default attack for malformed bestiary entries.

// ============ Enemy Trait Damage Modifiers ============
export const TRAIT_DAMAGE_WEAKNESS = 2; // Enemy trait weakness multiplier (double damage).
export const TRAIT_DAMAGE_RESISTANCE = 0.5; // Enemy trait resistance multiplier (half damage).

// ============ Status Tick Tuning ============
export const POISON_DECAY_AMOUNT = 1; // Poison stack decreases by this each tick.
export const POISON_GAIN_AMOUNT = 1; // Poison gain from talent proc.

// ============ Companion ============
export const COMPANION_GOLD_FIND_CHANCE = 0.5; // 50% chance for companion gold find on victory.
export const COMPANION_GOLD_MULTIPLIER = 1.2; // Companion gold find multiplies base gold by 1.2x.

// ============ Corruption ============
export const CORRUPTION_TRANSFORM_CHANCE = 0.5; // 50% chance corruption transforms card vs mutating in-place.
export const CORRUPTION_DELTA_CHANCE = 0.5; // 50% chance delta is +1 vs -1.

// ============ Named string enums ============
// String constants to prevent typos in state machine transitions and event dispatch.
export const SCREENS = {
  MENU: "menu",
  CHARACTER_SELECT: "character-select",
  BATTLE: "battle",
  REWARDS: "rewards",
  DESTINATION: "destination",
  CAMPFIRE: "campfire",
  CORRUPTION: "corruption",
  GAME_OVER: "game-over",
  COLLECTION: "collection",
  OPTIONS: "options",
  TALENTS: "talents",
  ACT_COMPLETE: "act-complete",
  RUN_VICTORY: "run-victory",
} as const;

export const MUSIC_KEYS = {
  MENU: "menu",
  BATTLE: "battle",
} as const;
