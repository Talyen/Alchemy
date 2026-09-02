export const TRAIT_FORGE_PER_TURN = 1;
export const IRON_HIDE_ARMOR_PER_TURN = 1;
export const TRAIT_FREEZE_BONUS_PER_TURN = 1;
export const IRON_HIDE_BURN_BONUS_PER_TURN = 1;
export const DIFFICULTY_FORGE_PER_TURN = 1;
export const LIVING_ARMOR_STARTING_ARMOR = 4;
export const ENEMY_STARTING_BLOCK = 4;

export const HELLHOUND_BURN_MULTIPLIER = 1.25;
export const BRAWLER_PENALTY_MULTIPLIER = 0.5;
export const BANDIT_FIRST_HIT_MULTIPLIER = 2;
export const NEXT_ATTACK_CRIT_MULTIPLIER = 2;
export const CONDITIONAL_FLAT_BONUS = 1;
export const OGRE_BLOCK_BREAK_MULTIPLIER = 2;
export const GIANT_SNAKE_EXTRA_BLOCK_STRIP = 1;
export const VAMPIRE_LEECH_CHANCE = 10;
export const ICE_WRAITH_FROZEN_PENALTY = 1;

export const TRAIT_DAMAGE_WEAKNESS = 2;
export const TRAIT_DAMAGE_RESISTANCE = 0.5;

export const TRAIT_BURN_VULNERABILITY = 1.5;

export const POISON_RESISTANCE_MULTIPLIER = 0.75;

export const LIVING_ARMOR_BLEED_MULTIPLIER = 0.75;

export const AMORPHOUS_DAMAGE_MULTIPLIER = 0.9;

export const TRAIT_MINOR_VULNERABILITY = 1.3;
export const TRAIT_MINOR_RESISTANCE = 0.7;
export const TRAIT_LIGHT_RESISTANCE = 0.8;

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
  { traitId: ENEMY_TRAIT_IDS.WILL_O_WISP, damageType: "physical", multiplier: TRAIT_MINOR_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.WILL_O_WISP, damageType: "freeze", multiplier: TRAIT_MINOR_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.BANDIT, damageType: "holy", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.OGRE, damageType: "holy", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.FIRE_IMP, damageType: "freeze", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.HELLHOUND, damageType: "freeze", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.PYROMANCER, damageType: "freeze", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.GIANT_SPIDER, damageType: "burn", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.GIANT_SNAKE, damageType: "freeze", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.BLOOD_CULTIST, damageType: "holy", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.DIRE_WOLF, damageType: "physical", multiplier: AMORPHOUS_DAMAGE_MULTIPLIER },
  { traitId: ENEMY_TRAIT_IDS.VAMPIRE, damageType: "holy", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.VAMPIRE, damageType: "burn", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.BLOOD_COUNTESS, damageType: "holy", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.ZEALOT, damageType: "bleed", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.INQUISITOR, damageType: "bleed", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.PALADIN, damageType: "holy", multiplier: TRAIT_MINOR_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.SERAPH, damageType: "bleed", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.WINTER_WOLF, damageType: "burn", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.ICE_WRAITH, damageType: "physical", multiplier: TRAIT_MINOR_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.ICE_WRAITH, damageType: "burn", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.ICE_WRAITH, damageType: "holy", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.YETI, damageType: "freeze", multiplier: TRAIT_MINOR_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.YETI, damageType: "burn", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.BANSHEE, damageType: "holy", multiplier: TRAIT_DAMAGE_WEAKNESS },
  { traitId: ENEMY_TRAIT_IDS.BRAWLER, damageType: "bleed", multiplier: TRAIT_MINOR_VULNERABILITY },
  { traitId: ENEMY_TRAIT_IDS.EARTH_ELEMENTAL, damageType: "freeze", multiplier: TRAIT_LIGHT_RESISTANCE },
  { traitId: ENEMY_TRAIT_IDS.EARTH_ELEMENTAL, damageType: "burn", multiplier: TRAIT_LIGHT_RESISTANCE },
];

export const REACTION_ONLY_ENEMY_TRAIT_IDS = [
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
