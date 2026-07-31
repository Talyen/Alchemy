import { computeTalentEffects, getGoldMultiplier } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId, UnlockedTalents, TalentEffectManifest } from "@/lib/game-data";
import type { CommitVictoryRewardsDeps, VictoryRewardsInput, VictoryRewardsResult } from "./victory-flow-types";
export type { CommitVictoryRewardsDeps, VictoryRewardsInput, VictoryRewardsResult } from "./victory-flow-types";
import { getEnemyMaterialLoot, applyMaterialFindBonus } from "@/lib/homestead/loot";
import { randomInt } from "@/lib/utils";
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
import { emptyInventory } from "@/lib/homestead/inventory";
import { CONSTANTS, type Destination } from "@/features/alchemy/shared/types";
import { syncBattleToRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import {
  getActiveRewardModifiersForContentSystem,
  applyLabyrinthRewardMaterialModifiers,
  computeVictoryGold,
  createCombatRewardState as createCombatRewardStateFromFlow,
  createBossRewardState as createBossRewardStateFromFlow,
  createWildwoodRewardState,
  getCompanionCardChoices,
  shouldGrantCompanionReward,
  type RewardState,
} from "./reward-flow";
import {
  sampleDestinationChoices,
  withSelectedBossForDestinations,
} from "@/features/alchemy/shared/run-flow/destination-flow";

// Pure victory reward computation extracted from use-run-navigation.
// Depends on: reward-flow, destination-flow, game data, game constants, homestead loot.
// Depended on by: useRunNavigation for computing battle victory outcomes.
export {
  withSelectedBossForDestinations,
  createDestinationRewardState,
} from "@/features/alchemy/shared/run-flow/destination-flow";

interface VictoryGoldRoll {
  gold: number;
  eliteBonus: number;
  bossBonus: number;
  generousBonus: number;
  baseGold: number;
}

function rollVictoryGold(
  battleState: BattleState,
  talentEffects: TalentEffectManifest,
  labyrinthRewardModifiers: EncounterRewardTraitId[],
  rng: () => number,
): VictoryGoldRoll {
  const baseGold = randomInt(GOLD_REWARD_MIN, GOLD_REWARD_MAX, rng);
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

  return { gold, eliteBonus, bossBonus, generousBonus, baseGold };
}

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
  rng: () => number = Math.random,
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
  rng: () => number = Math.random,
  destinationRng: () => number = rng,
): VictoryRewardsResult {
  const labyrinthRewardModifiers = getActiveRewardModifiersForContentSystem(
    input.contentSystemType,
    input.activeLabyrinthRewardModifiers,
  );

  const talentEffects = computeTalentEffects(input.unlockedTalents);
  if (input.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
    return {
      newGold: input.runGold,
      rewardState: createWildwoodRewardState(input.runDeck, rng, input.homesteadEffects.gearAstralChanceBonus),
      labyrinthRewardModifiers,
      destinations: [],
      materials: emptyInventory(),
      goldEarned: 0,
      playerHealth: input.battleState.playerHealth,
      maxHealthDelta: talentEffects.maxHealthPerCombat > 0 ? talentEffects.maxHealthPerCombat : 0,
      baseGold: 0,
      eliteBonus: 0,
      bossBonus: 0,
      generousBonus: 0,
      destinationOfferState: input.destinationOfferState,
    };
  }
  const { gold, eliteBonus, bossBonus, generousBonus, baseGold } = rollVictoryGold(
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
    newGold,
    rewardState,
    labyrinthRewardModifiers,
    destinations,
    materials,
    goldEarned: goldResult.earnedBeforeMultiplier,
    playerHealth,
    maxHealthDelta,
    baseGold,
    eliteBonus,
    bossBonus,
    generousBonus,
    destinationOfferState: sampled.offerState,
  };
}

export function commitVictoryRewards(
  result: VictoryRewardsResult,
  deps: CommitVictoryRewardsDeps,
  rng: () => number = Math.random,
): boolean {
  if (deps.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD && deps.battleState.pendingMaterials.crystal > 0) {
    deps.addHomesteadMaterials(deps.battleState.pendingMaterials);
  }

  deps.addRunGold(result.goldEarned);
  syncBattleToRun({ playerHealth: result.playerHealth });
  if (result.maxHealthDelta > 0) {
    deps.setRunMaxHealth((prev) => prev + result.maxHealthDelta);
  }

  deps.setRewardState({
    ...result.rewardState,
    lastVictoryEnemyType: deps.battleState.currentEnemy.enemyType,
    lastVictoryContentSystem: deps.contentSystemType,
  });
  deps.setDestinationOfferState(result.destinationOfferState);
  if (shouldGrantCompanionReward(result.labyrinthRewardModifiers)) {
    deps.setCompanionRewardCards(getCompanionCardChoices(rng));
  } else {
    deps.setCompanionRewardCards(null);
  }
  deps.setHasActiveBattle(false);
  return result.newGold > deps.battleState.gold;
}
