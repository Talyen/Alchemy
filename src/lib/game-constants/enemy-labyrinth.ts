// ============ Enemy Trait Tuning ============
export const TRAIT_FORGE_PER_TURN = 1;
export const IRON_HIDE_ARMOR_PER_TURN = 1;
export const TRAIT_FREEZE_BONUS_PER_TURN = 1;
export const IRON_HIDE_BURN_BONUS_PER_TURN = 1;
export const DIFFICULTY_FORGE_PER_TURN = 1;
export const LIVING_ARMOR_STARTING_ARMOR = 5;
export const ENEMY_STARTING_BLOCK = 4;

// ============ Labyrinth ============
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
  FREEZE_VULNERABILITY: "freeze-vulnerability",
  AMORPHOUS: "amorphous",
} as const;

// Trait damage rules: first matching (traitId, damageType) wins.
export const TRAIT_DAMAGE_RULES: Array<{ traitId: string; damageType: string; multiplier: number }> = [
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
  { traitId: ENEMY_TRAIT_IDS.FREEZE_VULNERABILITY, damageType: "freeze", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.AMORPHOUS, damageType: "physical", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.AMORPHOUS, damageType: "poison", multiplier: TRAIT_DAMAGE_RESISTANCE },
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
  BOSS_FORGE_GOLEM: "boss-forge-golem",
  BOSS_FROSTWARDEN: "boss-frostwarden",
  BOSS_BLIGHT_TREANT: "boss-blight-treant",
  BOSS_IRON_BEAR: "boss-iron-bear",
} as const;
