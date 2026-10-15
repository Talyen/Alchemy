// Materials economy: the single tuning surface for homestead-material payouts.
//
// Knob inventory (each knob's canonical home):
//   COMBAT_MATERIAL_QUANTITIES (here): normal/elite/boss totals by progression band.
//   LABYRINTH_REWARD_CONFIG (run-rewards.ts): scavenger material multiplier,
//     herbalist herb bonus, plus the gold/healing reward knobs.
//   Salvage chances (gear.ts): SALVAGE_*_CHANCE_FRACTION crafting-currency rolls.
//   Homestead find bonuses (homestead/data.ts): additive resource percentages
//     from buildings, farms, and research.
//   Reward pipeline order and the which-modifiers-apply-to-which-source policy
//     table (homestead/material-rewards.ts): computeCombatMaterialReward and
//     computeMysteryMaterialReward.

export const COMBAT_MATERIAL_QUANTITIES = {
  normal: [3, 4, 5],
  elite: [5, 6, 7],
  boss: [8, 10, 12],
} as const;

export const COMBAT_MATERIAL_BUNDLE_SIZE = 2;

export const STARTER_HOMESTEAD_MATERIAL_TARGET = { wood: 4, stone: 4 } as const;
