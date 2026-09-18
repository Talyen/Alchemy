// Materials economy: the single tuning surface for homestead-material payouts.
//
// Knob inventory (each knob's canonical home):
//   HOMESTEAD_LOOT_MULTIPLIERS (here): elite/boss combat multipliers.
//   LABYRINTH_REWARD_CONFIG (run-rewards.ts): scavenger material multiplier,
//     herbalist herb bonus, plus the gold/healing reward knobs.
//   Salvage chances (gear.ts): SALVAGE_*_CHANCE_FRACTION crafting-currency rolls.
//   End-of-run per-room yields (homestead/data.ts): endRun*PerRoom building,
//     farm, and research effects.
//   Per-enemy amounts (homestead/material-rewards.ts): enemyLootTables guaranteed + bonus
//     entries. These are content, not tuning: a Skeleton pays Herbs and a
//     Forge Golem pays Iron by design.
//   Reward pipeline order and the which-modifiers-apply-to-which-source policy
//     table (homestead/material-rewards.ts): computeCombatMaterialReward and
//     computeMysteryMaterialReward. The Wildwood exclusion lives separately in
//     run/run-materials.ts (awardsRunMaterialsFor).

export const HOMESTEAD_LOOT_MULTIPLIERS = {
  normal: 1,
  elite: 1.3,
  boss: 3,
} as const;
