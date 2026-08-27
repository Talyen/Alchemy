// ============ Enemy Trait Tuning ============
export const TRAIT_FORGE_PER_TURN = 1;
export const IRON_HIDE_ARMOR_PER_TURN = 1;
export const TRAIT_FREEZE_BONUS_PER_TURN = 1;
export const IRON_HIDE_BURN_BONUS_PER_TURN = 1;
export const DIFFICULTY_FORGE_PER_TURN = 1;
export const LIVING_ARMOR_STARTING_ARMOR = 4;
export const ENEMY_STARTING_BLOCK = 4;

// ============ Labyrinth ============
export const LABYRINTH_MAP_UI = {
  inspectorWidthPx: 320,
} as const;
export const FALLBACK_ENEMY_ATTACK = 8;

// ============ Enemy Trait Damage Modifiers ============
export const TRAIT_DAMAGE_WEAKNESS = 2;
const TRAIT_DAMAGE_RESISTANCE = 0.5;
/** Burn Vulnerability / Glacial Shell / Trinket Hoarder: 50% more Burn (take 150%). */
const TRAIT_BURN_VULNERABILITY = 1.5;
/** Poison Resistance: 25% less Poison (take 75%). */
const POISON_RESISTANCE_MULTIPLIER = 0.75;
/** Living Armor: 25% less Bleed (take 75%). */
const LIVING_ARMOR_BLEED_MULTIPLIER = 0.75;
/** Amorphous: 10% less Physical and Poison (take 90%). */
const AMORPHOUS_DAMAGE_MULTIPLIER = 0.9;

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
  DODGE_NOTICE: "Dodge",
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
  FREEZE_VULNERABILITY: "freeze-vulnerability",
  AMORPHOUS: "amorphous",
} as const;

// Trait damage rules: first matching (traitId, damageType) wins.
export const TRAIT_DAMAGE_RULES: Array<{ traitId: string; damageType: string; multiplier: number }> = [
  { traitId: ENEMY_TRAIT_IDS.BRITTLE_BONES, damageType: "holy", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.BRITTLE_BONES, damageType: "stun", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.TRINKET_HOARDER, damageType: "burn", multiplier: TRAIT_BURN_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.HOLY_VULNERABILITY, damageType: "holy", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.BURN_RESISTANCE, damageType: "burn", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.BURN_VULNERABILITY, damageType: "burn", multiplier: TRAIT_BURN_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.LIVING_ARMOR, damageType: "bleed", multiplier: LIVING_ARMOR_BLEED_MULTIPLIER },
  { traitId: ENEMY_TRAIT_IDS.THICK_HIDE, damageType: "physical", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.POISON_RESISTANCE, damageType: "poison", multiplier: POISON_RESISTANCE_MULTIPLIER },
  { traitId: ENEMY_TRAIT_IDS.GLACIAL_SHELL, damageType: "freeze", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.GLACIAL_SHELL, damageType: "burn", multiplier: TRAIT_BURN_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.FREEZE_VULNERABILITY, damageType: "freeze", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.AMORPHOUS, damageType: "physical", multiplier: AMORPHOUS_DAMAGE_MULTIPLIER },
  { traitId: ENEMY_TRAIT_IDS.AMORPHOUS, damageType: "poison", multiplier: AMORPHOUS_DAMAGE_MULTIPLIER },
];

// ============ Companion ============
export const COMPANION_GOLD_FIND_CHANCE = 0.5;
export const COMPANION_GOLD_MULTIPLIER = 1.2;
export const COMPANION_SOUND_CARD_IDS: Record<string, string> = {
  wolf: "wolf-companion",
  "lizard-scout": "lizard-scout-companion",
};

// ============ Homestead Loot ============
export const HOMESTEAD_LOOT_CONFIG = {
  enemyTypeMultipliers: {
    normal: 1,
    elite: 1.3,
    boss: 3,
  },
} as const;
