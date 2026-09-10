export const TRAIT_FORGE_PER_TURN = 1;
export const IRON_HIDE_ARMOR_PER_TURN = 1;
export const TRAIT_FREEZE_BONUS_PER_TURN = 1;
export const GLACIAL_SURGE_MAX_FREEZE_BONUS = 2;
export const DIFFICULTY_FORGE_PER_TURN = 1;
export const LIVING_ARMOR_STARTING_ARMOR = 4;
export const ENEMY_STARTING_BLOCK = 4;

export const HELLHOUND_BURN_MULTIPLIER = 1.25;
export const BRAWLER_PENALTY_MULTIPLIER = 0.5;
export const BANDIT_FIRST_HIT_MULTIPLIER = 2;
export const CONDITIONAL_FLAT_BONUS = 1;
export const ENEMY_ABILITY_TRAIT_REWARD = 1;
export const INQUISITOR_BURN_MULTIPLIER = 2;
export const VAMPIRE_BLOOD_SCENT_DAMAGE = 1;
export const OGRE_BLOCK_BREAK_MULTIPLIER = 2;
export const GIANT_SNAKE_EXTRA_BLOCK_STRIP = 1;

export const TRAIT_DAMAGE_WEAKNESS = 2;
const TRAIT_DAMAGE_RESISTANCE = 0.5;

const TRAIT_BURN_VULNERABILITY = 1.3;

const POISON_RESISTANCE_MULTIPLIER = 0.75;

const LIVING_ARMOR_BLEED_MULTIPLIER = 0.75;

const AMORPHOUS_DAMAGE_MULTIPLIER = 0.9;

const TRAIT_MINOR_VULNERABILITY = 1.3;
const TRAIT_MINOR_RESISTANCE = 0.7;
const TRAIT_LIGHT_RESISTANCE = 0.8;

export const ENEMY_TRAIT_IDS = {
  GLACIAL_BODY: "glacial-body",
  MINOR_FREEZE_VULNERABILITY: "minor-freeze-vulnerability",
  COLD_BLOODED: "cold-blooded",
  MINOR_HOLY_VULNERABILITY: "minor-holy-vulnerability",
  TOUGH_HIDE: "tough-hide",
  VAMPIRIC_CURSE: "vampiric-curse",
  FROZEN_APPARITION: "frozen-apparition",
  WINTER_HIDE: "winter-hide",
  EARTHEN_BODY: "earthen-body",

  BRITTLE_BONES: "brittle-bones",
  HOLY_VULNERABILITY: "holy-vulnerability",
  BURN_RESISTANCE: "burn-resistance",
  BURN_VULNERABILITY: "burn-vulnerability",
  LIVING_ARMOR: "living-armor",
  THICK_HIDE: "thick-hide",
  POISON_RESISTANCE: "poison-resistance",
  GLACIAL_SHELL: "glacial-shell",
  FROST_ELEMENTAL: "frost-elemental",
  GOLD_TROVE: "gold-trove",
  STARTING_BLOCK: "starting-block",
  FREEZE_VULNERABILITY: "freeze-vulnerability",
  AMORPHOUS: "amorphous",
  WILL_O_WISP: "will-o-wisp",
  BANDIT: "bandit",
  OGRE: "ogre",
  FIRE_IMP: "fire-imp",
  HELLHOUND: "hellhound",
  PYROMANCER: "pyromancer",
  GIANT_SPIDER: "giant-spider",
  GIANT_SNAKE: "giant-snake",
  BLOOD_CULTIST: "blood-cultist",
  DIRE_WOLF: "dire-wolf",
  VAMPIRE: "vampire",
  BLOOD_COUNTESS: "blood-countess",
  ZEALOT: "zealot-enemy",
  CLERIC: "cleric",
  INQUISITOR: "inquisitor",
  PALADIN: "paladin",
  SERAPH: "seraph",
  WINTER_WOLF: "winter-wolf",
  ICE_WRAITH: "ice-wraith",
  YETI: "yeti",
  BANSHEE: "banshee",
  BRAWLER: "brawler",
  STONE_GOLEM: "stone-golem",
  EARTH_ELEMENTAL: "earth-elemental",
  STONE_TITAN: "stone-titan",
} as const;

export const TRAIT_DAMAGE_RULES: Array<{ traitId: string; damageType: string; multiplier: number }> = [
  { traitId: ENEMY_TRAIT_IDS.BRITTLE_BONES, damageType: "stun", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.HOLY_VULNERABILITY, damageType: "holy", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.BURN_RESISTANCE, damageType: "burn", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.BURN_VULNERABILITY, damageType: "burn", multiplier: TRAIT_BURN_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.LIVING_ARMOR, damageType: "bleed", multiplier: LIVING_ARMOR_BLEED_MULTIPLIER },
  { traitId: ENEMY_TRAIT_IDS.THICK_HIDE, damageType: "physical", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.POISON_RESISTANCE, damageType: "poison", multiplier: POISON_RESISTANCE_MULTIPLIER },
  { traitId: ENEMY_TRAIT_IDS.GLACIAL_BODY, damageType: "freeze", multiplier: TRAIT_DAMAGE_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.GLACIAL_BODY, damageType: "burn", multiplier: TRAIT_BURN_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.FREEZE_VULNERABILITY, damageType: "freeze", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.AMORPHOUS, damageType: "physical", multiplier: AMORPHOUS_DAMAGE_MULTIPLIER },
  { traitId: ENEMY_TRAIT_IDS.AMORPHOUS, damageType: "poison", multiplier: AMORPHOUS_DAMAGE_MULTIPLIER },
  { traitId: ENEMY_TRAIT_IDS.WILL_O_WISP, damageType: "physical", multiplier: TRAIT_MINOR_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.WILL_O_WISP, damageType: "freeze", multiplier: TRAIT_MINOR_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.MINOR_FREEZE_VULNERABILITY, damageType: "freeze", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.COLD_BLOODED, damageType: "freeze", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.MINOR_HOLY_VULNERABILITY, damageType: "holy", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.TOUGH_HIDE, damageType: "physical", multiplier: AMORPHOUS_DAMAGE_MULTIPLIER },
  { traitId: ENEMY_TRAIT_IDS.VAMPIRIC_CURSE, damageType: "holy", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.VAMPIRIC_CURSE, damageType: "burn", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.BLOOD_COUNTESS, damageType: "holy", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.PALADIN, damageType: "holy", multiplier: TRAIT_MINOR_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.FROZEN_APPARITION, damageType: "physical", multiplier: TRAIT_MINOR_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.FROZEN_APPARITION, damageType: "burn", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.FROZEN_APPARITION, damageType: "holy", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.WINTER_HIDE, damageType: "freeze", multiplier: TRAIT_MINOR_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.WINTER_HIDE, damageType: "burn", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.EARTHEN_BODY, damageType: "freeze", multiplier: TRAIT_LIGHT_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.EARTHEN_BODY, damageType: "burn", multiplier: TRAIT_LIGHT_RESISTANCE },
];

export const REACTION_ONLY_ENEMY_TRAIT_IDS = [
  ENEMY_TRAIT_IDS.FROST_ELEMENTAL,
  ENEMY_TRAIT_IDS.WILL_O_WISP,
  ENEMY_TRAIT_IDS.BANDIT,
  ENEMY_TRAIT_IDS.OGRE,
  ENEMY_TRAIT_IDS.FIRE_IMP,
  ENEMY_TRAIT_IDS.HELLHOUND,
  ENEMY_TRAIT_IDS.PYROMANCER,
  ENEMY_TRAIT_IDS.GIANT_SPIDER,
  ENEMY_TRAIT_IDS.GIANT_SNAKE,
  ENEMY_TRAIT_IDS.BLOOD_CULTIST,
  ENEMY_TRAIT_IDS.DIRE_WOLF,
  ENEMY_TRAIT_IDS.VAMPIRE,
  ENEMY_TRAIT_IDS.BLOOD_COUNTESS,
  ENEMY_TRAIT_IDS.ZEALOT,
  ENEMY_TRAIT_IDS.INQUISITOR,
  ENEMY_TRAIT_IDS.PALADIN,
  ENEMY_TRAIT_IDS.SERAPH,
  ENEMY_TRAIT_IDS.WINTER_WOLF,
  ENEMY_TRAIT_IDS.ICE_WRAITH,
  ENEMY_TRAIT_IDS.YETI,
  ENEMY_TRAIT_IDS.BANSHEE,
  ENEMY_TRAIT_IDS.BRAWLER,
  ENEMY_TRAIT_IDS.STONE_GOLEM,
  ENEMY_TRAIT_IDS.EARTH_ELEMENTAL,
  ENEMY_TRAIT_IDS.STONE_TITAN,
] as const;

export const COMPANION_GOLD_FIND_CHANCE = 0.5;
export const COMPANION_GOLD_MULTIPLIER = 1.2;
export const COMPANION_SOUND_CARD_IDS: Record<string, string> = {
  wolf: "wolf-companion",
  "lizard-scout": "lizard-scout-companion",
};
