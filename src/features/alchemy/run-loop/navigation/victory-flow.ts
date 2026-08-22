import { computeTalentEffects, getGoldMultiplier } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId, UnlockedTalents, TalentEffectManifest } from "@/lib/game-data";
import type { VictoryRewardsInput, VictoryRewardsResult } from "./victory-flow-types";
export type { VictoryRewardsInput, VictoryRewardsResult } from "./victory-flow-types";
import { getEnemyMaterialLoot, applyMaterialFindBonus } from "@/lib/homestead/loot";
import {
  COMPANION_GOLD_FIND_CHANCE,
  COMPANION_GOLD_MULTIPLIER,
  ELITE_GOLD_BONUS_FRACTION,
  BOSS_GOLD_BONUS_FRACTION,
  ENEMY_TRAIT_IDS,
  GOLD_REWARD_MIN,
  GOLD_REWARD_MAX,
  GOLD_TROVE_REWARD_MULTIPLIER,
} from "@/lib/game-constants";
import { getGenerousGoldBonus } from "./reward-flow";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RewardState } from "@/lib/active-run-session";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import type { Destination } from "@/lib/routing";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import {
  getActiveRewardModifiersForContentSystem,
  applyLabyrinthRewardMaterialModifiers,
  computeVictoryGold,
  createCombatRewardState as createCombatRewardStateFromFlow,
  createBossRewardState as createBossRewardStateFromFlow,
  createWildwoodRewardState,
} from "./reward-flow";
import {
  sampleDestinationChoices,
  withSelectedBossForDestinations,
} from "@/features/alchemy/shared/run-flow/destination-flow";

// Pure victory reward computation for run-flow victory handlers.
// Depends on: reward-flow, destination-flow, game data, game constants, homestead loot.
// Depended on by: useRunFlowEngine for computing battle victory outcomes.

interface VictoryGoldRoll {
  gold: number;
  eliteBonus: number;
  bossBonus: number;
  generousBonus: number;
}

function rollVictoryGold(
  battleState: BattleState,
  talentEffects: TalentEffectManifest,
  labyrinthRewardModifiers: EncounterRewardTraitId[],
  rng: () => number,
): VictoryGoldRoll {
  const baseGold = Math.floor(rng() * (GOLD_REWARD_MAX - GOLD_REWARD_MIN + 1) + GOLD_REWARD_MIN);
  let gold = Math.floor(baseGold * (1 + talentEffects.enemyGoldDropBonus));

  if (talentEffects.companionGoldFindActive && battleState.activeCompanion && rng() < COMPANION_GOLD_FIND_CHANCE) {
    gold = Math.floor(gold * COMPANION_GOLD_MULTIPLIER);
  }

  if (battleState.currentEnemy.traits?.some((t) => t.id === ENEMY_TRAIT_IDS.GOLD_TROVE)) {
    gold = Math.floor(gold * GOLD_TROVE_REWARD_MULTIPLIER);
  }

  const eliteFraction =
    ELITE_GOLD_BONUS_FRACTION +
    (battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE ? talentEffects.eliteGoldDropBonus : 0);
  const eliteBonus =
    battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE ? Math.floor(gold * eliteFraction) : 0;
  const bossBonus =
    battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.BOSS ? Math.floor(gold * BOSS_GOLD_BONUS_FRACTION) : 0;
  const generousBonus = getGenerousGoldBonus(labyrinthRewardModifiers, gold);

  return { gold, eliteBonus, bossBonus, generousBonus };
}

/** Builds the RewardState handed to the rewards screen from rolled victory gold/materials. */
export function computeVictoryRewardState(
  input: {
    characterId: CharacterId;
    selectedDifficulty: DifficultyId | null;
    unlockedTalents: UnlockedTalents;
    runDeck: BattleCard[];
    runTrinkets: string[];
    contentSystemType: ContentSystemId;
    activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
    battleState: BattleState;
    gold: number;
    eliteBonus: number;
    generousBonus: number;
    bossBonus: number;
    materials: MaterialInventory;
    destinations: Destination[];
    talentEffects?: TalentEffectManifest;
    bossEnemyId?: string | null | undefined;
    gearAstralChanceBonus?: number;
  },
  rng: () => number,
): RewardState {
  const talentEffects = input.talentEffects ?? computeTalentEffects(input.unlockedTalents);
  const goldMultiplier = getGoldMultiplier(input.characterId, input.selectedDifficulty);
  const gearAstralChanceBonus = input.gearAstralChanceBonus ?? 0;

  if (input.battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.BOSS) {
    return createBossRewardStateFromFlow({
      gold: input.gold,
      bossBonus: input.bossBonus,
      generousBonus: input.generousBonus,
      talentGoldPerCombat: talentEffects.goldPerCombat,
      materials: input.materials,
      trinketIds: input.runTrinkets,
      goldMultiplier,
      rng,
      gearAstralChanceBonus,
    });
  }

  return withSelectedBossForDestinations(
    input.destinations,
    createCombatRewardStateFromFlow({
      battleState: input.battleState,
      runDeck: input.runDeck,
      gold: input.gold,
      eliteBonus: input.eliteBonus,
      generousBonus: input.generousBonus,
      talentGoldPerCombat: talentEffects.goldPerCombat,
      materials: input.materials,
      destinations: input.destinations,
      trinketIds: input.runTrinkets,
      goldMultiplier,
      rng,
    }),
    input.bossEnemyId,
  );
}

export function computeVictoryRewards(
  input: VictoryRewardsInput,
  rng: () => number,
  destinationRng: () => number = rng,
): VictoryRewardsResult {
  const labyrinthRewardModifiers = getActiveRewardModifiersForContentSystem(
    input.contentSystemType,
    input.activeLabyrinthRewardModifiers,
  );

  const talentEffects = computeTalentEffects(input.unlockedTalents);
  if (input.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
    const goldEarned = Math.max(0, input.battleState.gold - input.runGold);
    return {
      rewardState: createWildwoodRewardState(input.runDeck, rng, input.homesteadEffects.gearAstralChanceBonus),
      labyrinthRewardModifiers,
      goldEarned,
      playerHealth: input.battleState.playerHealth,
      maxHealthDelta: talentEffects.maxHealthPerCombat > 0 ? talentEffects.maxHealthPerCombat : 0,
      destinationOfferState: input.destinationOfferState,
    };
  }
  const { gold, eliteBonus, bossBonus, generousBonus } = rollVictoryGold(
    input.battleState,
    talentEffects,
    labyrinthRewardModifiers,
    rng,
  );

  const goldResult = computeVictoryGold({
    battleState: input.battleState,
    runGold: input.runGold,
    runTrinkets: input.runTrinkets,
    gold,
    eliteBonus,
    generousBonus,
    bossBonus,
    talentGoldPerCombat: talentEffects.goldPerCombat,
    goldMultiplier: getGoldMultiplier(input.characterId, input.selectedDifficulty),
  });

  const newGold = goldResult.persistedRunGold;

  const playerHealth = input.battleState.playerHealth;
  const maxHealthDelta = talentEffects.maxHealthPerCombat > 0 ? talentEffects.maxHealthPerCombat : 0;

  const baseMaterials = getEnemyMaterialLoot(
    input.battleState.currentEnemy.id,
    input.battleState.currentEnemy.enemyType,
    rng,
  );
  const materials = applyLabyrinthRewardMaterialModifiers(
    applyMaterialFindBonus(baseMaterials, input.homesteadEffects),
    labyrinthRewardModifiers,
  );

  const eligibleDestinations = input.getAvailableDestinations({
    currentHealth: input.battleState.playerHealth,
    currentGold: newGold,
    destinationIndexInAct: input.destinationIndexInAct,
    maxHealth: input.runMaxHealth,
  });
  const sampled = sampleDestinationChoices(eligibleDestinations, input.destinationOfferState, destinationRng);
  const destinations = sampled.choices;

  const rewardState = computeVictoryRewardState(
    {
      characterId: input.characterId,
      selectedDifficulty: input.selectedDifficulty,
      unlockedTalents: input.unlockedTalents,
      runDeck: input.runDeck,
      runTrinkets: input.runTrinkets,
      contentSystemType: input.contentSystemType,
      activeLabyrinthRewardModifiers: input.activeLabyrinthRewardModifiers,
      battleState: input.battleState,
      gold,
      eliteBonus,
      generousBonus,
      bossBonus,
      materials,
      destinations,
      talentEffects,
      bossEnemyId: input.bossEnemyId,
      gearAstralChanceBonus: input.homesteadEffects.gearAstralChanceBonus,
    },
    rng,
  );

  return {
    rewardState,
    labyrinthRewardModifiers,
    goldEarned: goldResult.earnedBeforeMultiplier,
    playerHealth,
    maxHealthDelta,
    destinationOfferState: sampled.offerState,
  };
}
