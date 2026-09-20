import { defineBuilding, defineFarm, defineResearch, materialCost, stackingTiers } from "./data-builders";

export const buildings = [
  defineBuilding(
    "blacksmiths-forge",
    "Blacksmith",
    stackingTiers(
      [
        materialCost({ stone: 8, iron: 22 }),
        materialCost({ stone: 12, iron: 33 }),
        materialCost({ stone: 16, iron: 44 }),
        materialCost({ stone: 20, iron: 55 }),
      ],
      { flatPhysicalDamage: 1, homesteadForgeBurnPercent: 25, endRunIronPerRoom: 1 },
      (t) => `Physical damage +${t}\nBurn damage gains ${25 * t}% of Forge.`,
      (t) => `+${t} Iron per Room`,
    ),
  ),
  defineBuilding(
    "hunters-lodge",
    "Hunter's Lodge",
    stackingTiers(
      [
        materialCost({ wood: 8, hide: 10 }),
        materialCost({ wood: 12, hide: 15 }),
        materialCost({ wood: 16, hide: 20 }),
        materialCost({ wood: 20, hide: 25 }),
      ],
      { flatNatureDamage: 1, endRunFoodPerRoom: 1, endRunHidePerRoom: 1 },
      (t) => `Nature damage +${t}`,
      (t) => `+${t} Food and +${t} Hide per Room`,
    ),
  ),
  defineBuilding(
    "alchemy-lab",
    "Alchemy Lab",
    stackingTiers(
      [
        materialCost({ herbs: 22 }),
        materialCost({ stone: 12, herbs: 33 }),
        materialCost({ stone: 16, herbs: 44 }),
        materialCost({ stone: 20, herbs: 55 }),
      ],
      { homesteadPotionBonus: 1, endRunHerbsPerRoom: 1 },
      (t) => `Potion damage and healing +${t}`,
      (t) => `+${t} Herbs per Room`,
    ),
  ),
  defineBuilding(
    "runesmiths-workshop",
    "Runesmith",
    stackingTiers(
      [
        materialCost({ iron: 11, gems: 11 }),
        materialCost({ iron: 17, gems: 16 }),
        materialCost({ iron: 22, gems: 21 }),
        materialCost({ iron: 28, gems: 26 }),
      ],
      { flatFreezeDamage: 1, flatHolyDamage: 1, endRunGemsPerRoom: 1 },
      (t) => `Freeze and Holy damage +${t}`,
      (t) => `+${t} Gems per Room`,
    ),
  ),
  defineBuilding(
    "companion-sanctuary",
    "Sanctuary",
    stackingTiers(
      [
        materialCost({ wood: 8, food: 12 }),
        materialCost({ wood: 12, food: 17 }),
        materialCost({ wood: 16, food: 23 }),
        materialCost({ wood: 20, food: 29 }),
      ],
      { companionDamage: 1 },
      (t) => `Companion damage +${t}`,
    ),
  ),
  defineBuilding(
    "wishing-well",
    "Wishing Well",
    stackingTiers(
      [
        materialCost({ wood: 8, stone: 8 }),
        materialCost({ wood: 12, stone: 12 }),
        materialCost({ wood: 16, stone: 16 }),
        materialCost({ wood: 20, stone: 20 }),
      ],
      { wishExtraChoiceChance: 10, endRunWishPerRoom: 1 },
      (t) => `${10 * t}% chance for an extra Wish choice`,
      (t) => `+${t} Gems or Gold per Room`,
    ),
  ),
  defineBuilding(
    "transmutation-crucible",
    "Transmutation Crucible",
    stackingTiers(
      [
        materialCost({ stone: 8, iron: 11 }),
        materialCost({ stone: 12, iron: 17 }),
        materialCost({ stone: 16, iron: 22 }),
        materialCost({ stone: 20, iron: 28 }),
      ],
      { flatBurnDamage: 1, endRunIronPerRoom: 1 },
      (t) => `Burn damage +${t}`,
      (t) => `+${t} Iron per Room`,
    ),
  ),
  defineBuilding(
    "mycology-cellar",
    "Mycology Cellar",
    stackingTiers(
      [
        materialCost({ stone: 8, herbs: 11 }),
        materialCost({ stone: 12, herbs: 17 }),
        materialCost({ stone: 16, herbs: 22 }),
        materialCost({ stone: 20, herbs: 28 }),
      ],
      { homesteadLeechHealing: 1, endRunHerbsPerRoom: 1 },
      (t) => `Leech healing +${t}`,
      (t) => `+${t} Herbs per Room`,
    ),
  ),
  defineBuilding(
    "sparring-grounds",
    "Sparring Grounds",
    stackingTiers(
      [
        materialCost({ wood: 8, stone: 8 }),
        materialCost({ wood: 12, stone: 12 }),
        materialCost({ wood: 16, stone: 16 }),
        materialCost({ wood: 20, stone: 20 }),
      ],
      { startBlock: 2, endRunIronPerRoom: 1 },
      (t) => `Starting Block +${2 * t}`,
      (t) => `+${t} Iron per Room`,
    ),
  ),
  defineBuilding(
    "archery-range",
    "Archery Range",
    stackingTiers(
      [
        materialCost({ wood: 8, hide: 10 }),
        materialCost({ wood: 12, hide: 15 }),
        materialCost({ wood: 16, hide: 20 }),
        materialCost({ wood: 20, hide: 25 }),
      ],
      { flatArrowDamage: 1, endRunWoodPerRoom: 1 },
      (t) => `Archery damage +${t}`,
      (t) => `+${t} Wood per Room`,
    ),
  ),
  defineBuilding(
    "library",
    "Library",
    stackingTiers(
      [
        materialCost({ wood: 8, gems: 11 }),
        materialCost({ wood: 12, gems: 16 }),
        materialCost({ wood: 16, gems: 21 }),
        materialCost({ wood: 20, gems: 26 }),
      ],
      { removeCardDiscount: 2 },
      (t) => `Removal cost −${2 * t} Gold`,
    ),
  ),
];

export const farmPlots = [
  defineFarm(
    "wheat-field",
    "Wheat Field",
    stackingTiers(
      [materialCost({ food: 23 }), materialCost({ food: 35 }), materialCost({ food: 46 }), materialCost({ food: 58 })],
      { cardHealBonus: { bread: 2 }, endRunFoodPerRoom: 2 },
      (t) => `Bread healing +${2 * t}`,
      (t) => `+${2 * t} Food per Room`,
    ),
  ),
  defineFarm(
    "herb-garden",
    "Herb Garden",
    stackingTiers(
      [
        materialCost({ herbs: 22 }),
        materialCost({ herbs: 33 }),
        materialCost({ herbs: 44 }),
        materialCost({ herbs: 55 }),
      ],
      { poisonDamageReduction: 1, endRunHerbsPerRoom: 1 },
      (t) => `Poison damage taken −${t}`,
      (t) => `+${t} Herbs per Room`,
    ),
  ),
  defineFarm(
    "chicken-coop",
    "Chicken Coop",
    stackingTiers(
      [
        materialCost({ wood: 8, food: 12 }),
        materialCost({ wood: 12, food: 17 }),
        materialCost({ wood: 16, food: 23 }),
        materialCost({ wood: 20, food: 29 }),
      ],
      { runMaxHealthBonus: 5, endRunFoodPerRoom: 2 },
      (t) => `Health +${5 * t}`,
      (t) => `+${2 * t} Food per Room`,
    ),
  ),
  defineFarm(
    "pasture",
    "Pasture",
    stackingTiers(
      [
        materialCost({ wood: 8, food: 12 }),
        materialCost({ wood: 12, food: 17 }),
        materialCost({ wood: 16, food: 23 }),
        materialCost({ wood: 20, food: 29 }),
      ],
      { physicalDamageReduction: 1, endRunHidePerRoom: 1 },
      (t) => `Physical damage taken −${t}`,
      (t) => `+${t} Hide per Room`,
    ),
  ),
  defineFarm(
    "orchard",
    "Orchard",
    stackingTiers(
      [
        materialCost({ wood: 8, food: 12 }),
        materialCost({ wood: 12, food: 17 }),
        materialCost({ wood: 16, food: 23 }),
        materialCost({ wood: 20, food: 29 }),
      ],
      { cardHealBonus: { apple: 2 }, endRunFoodPerRoom: 2 },
      (t) => `Apple healing +${2 * t}`,
      (t) => `+${2 * t} Food per Room`,
    ),
  ),
  defineFarm(
    "crystal-garden",
    "Crystal Garden",
    stackingTiers(
      [
        materialCost({ stone: 8, gems: 21 }),
        materialCost({ stone: 12, gems: 32 }),
        materialCost({ stone: 16, gems: 42 }),
        materialCost({ stone: 20, gems: 53 }),
      ],
      { homesteadCriticalDamage: 1, endRunGemsPerRoom: 2, endRunStonePerRoom: 1 },
      (t) => `Critical damage +${t}`,
      (t) => `+${2 * t} Gems and +${t} Stone per Room`,
    ),
  ),
];

export const researchUpgrades = [
  defineResearch(
    "leyline-energy",
    "Leyline Energy",
    stackingTiers(
      [materialCost({ gems: 21 }), materialCost({ gems: 32 }), materialCost({ gems: 42 }), materialCost({ gems: 53 })],
      { homesteadFreeManaChance: 5, endRunGemsPerRoom: 1 },
      (t) => `${5 * t}% chance to spend no Mana`,
      (t) => `+${t} Gems per Room`,
    ),
  ),
  defineResearch(
    "detect-magic",
    "Detect Magic",
    stackingTiers(
      [materialCost({ gems: 21 }), materialCost({ gems: 32 }), materialCost({ gems: 42 }), materialCost({ gems: 53 })],
      { gearAstralChanceBonus: 0.03, endRunGemsPerRoom: 1 },
      (t) => `Basic → Astral chance +${[3, 6, 10, 15][t - 1]}%`,
      (t) => `+${t} Gems per Room`,
    ).map((tier, index) => ({
      ...tier,
      effects: { ...tier.effects, gearAstralChanceBonus: index < 2 ? 0.03 : index === 2 ? 0.04 : 0.05 },
    })),
  ),
  defineResearch(
    "botanical-distillation",
    "Botanical Distillation",
    stackingTiers(
      [
        materialCost({ herbs: 22 }),
        materialCost({ herbs: 33 }),
        materialCost({ herbs: 44 }),
        materialCost({ herbs: 55 }),
      ],
      { mixPotionDiscount: 2, endRunHerbsPerRoom: 1 },
      (t) => `Potion mixing cost −${2 * t} Gold`,
      (t) => `+${t} Herbs per Room`,
    ),
  ),
  defineResearch(
    "culinary-arts",
    "Culinary Arts",
    stackingTiers(
      [materialCost({ food: 23 }), materialCost({ food: 35 }), materialCost({ food: 46 }), materialCost({ food: 58 })],
      { homesteadHealing: 1, endRunFoodPerRoom: 1 },
      (t) => `Health restored +${t}`,
      (t) => `+${t} Food per Room`,
    ),
  ),
  defineResearch(
    "wool-tailoring",
    "Wool Tailoring",
    stackingTiers(
      [
        materialCost({ wood: 8, hide: 10 }),
        materialCost({ wood: 12, hide: 15 }),
        materialCost({ wood: 16, hide: 20 }),
        materialCost({ wood: 20, hide: 25 }),
      ],
      { freezeDamageReduction: 1, burnDamageReduction: 1, endRunGoldPerRoom: 1 },
      (t) => `Freeze and Burn damage taken −${t}`,
      (t) => `+${t} Gold per Room`,
    ),
  ),
  defineResearch(
    "agility-training",
    "Agility Training",
    stackingTiers(
      [
        materialCost({ food: 12, hide: 10 }),
        materialCost({ food: 17, hide: 15 }),
        materialCost({ food: 23, hide: 20 }),
        materialCost({ food: 29, hide: 25 }),
      ],
      { dodgeChance: 2 },
      (t) => `Dodge +${2 * t}%`,
    ),
  ),
];
