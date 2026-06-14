// Reward state, gold math, routing, and combat/boss reward builders.
import {
  cardLibrary,
  getOfferableCardPool,
  getStandardPotionPool,
  selectRewardCards,
  boonLibrary,
  type BattleCard,
  type BoonEntry,
} from "@/lib/game-data";
import {
  BOSS_BOON_REWARD_CHOICES,
  ELITE_BOON_REWARD_CHANCE,
  LABYRINTH_REWARD_CONFIG,
  REWARD_CARD_CHOICES,
  REWARD_BOON_CHANCE,
  CAMPAIGN_GEAR_REWARD_CHANCE,
  LABYRINTH_GEAR_REWARD_CHANCE,
  BOSS_GEAR_REWARD_CHANCE,
} from "@/lib/game-constants";
import { computeBoonManifest } from "@/lib/boons";
import type { MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { BattleState } from "@/lib/battle";
import { shuffle } from "@/lib/utils";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { sampleItems } from "../../shared/utils";
import { gearDefinitionList, type GearDefinition } from "@/lib/gear";

export type RewardState = {
  choices: (BattleCard | BoonEntry | GearDefinition)[];
  gold: number;
  materials: MaterialInventory;
  selectedId: string | null;
  destinations: Destination[];
  rewardType: "card" | "boon" | "gear";
  selectedBossId: string | null;
  /** Stamped at victory commit so reward routing does not depend on battle state. */
  lastVictoryEnemyType: string | null;
  lastVictoryContentSystem: ContentSystemId | null;
};

export function createEmptyRewardState(destinations: Destination[] = []): RewardState {
  return {
    choices: [],
    gold: 0,
    materials: emptyInventory(),
    selectedId: null,
    destinations,
    rewardType: "card",
    selectedBossId: null,
    lastVictoryEnemyType: null,
    lastVictoryContentSystem: null,
  };
}

export function createNextRewardState(rewardState: RewardState): RewardState {
  return {
    ...createEmptyRewardState(rewardState.destinations),
    selectedBossId: rewardState.selectedBossId,
    lastVictoryEnemyType: rewardState.lastVictoryEnemyType,
    lastVictoryContentSystem: rewardState.lastVictoryContentSystem,
  };
}

export type VictoryGoldInput = {
  battleState: Pick<BattleState, "gold">;
  runGold: number;
  runBoons: string[];
  gold: number;
  eliteBonus: number;
  generousBonus: number;
  bossBonus: number;
  talentGoldPerCombat: number;
  goldMultiplier: number;
};

export type VictoryGoldTotalInput = Omit<VictoryGoldInput, "runGold" | "goldMultiplier">;

export type VictoryGoldResult = {
  unmultipliedTotal: number;
  earnedBeforeMultiplier: number;
  persistedRunGold: number;
};

export type RewardGoldInput = {
  baseGold: number;
  bonusGold: number;
  generousBonus: number;
  talentGoldPerCombat: number;
  boonIds: string[];
  goldMultiplier: number;
};

function hasRewardModifier(modifiers: EncounterRewardTraitId[], kind: EncounterRewardTraitId): boolean {
  return modifiers.includes(kind);
}

function createModifierGuard(kind: EncounterRewardTraitId) {
  return (modifiers: EncounterRewardTraitId[]): boolean => hasRewardModifier(modifiers, kind);
}

export const shouldForceBoonReward = createModifierGuard("collector");
export const shouldGrantCompanionReward = createModifierGuard("companion");
export const shouldGrantAlchemistReward = createModifierGuard("alchemist");

export function getActiveRewardModifiersForContentSystem(
  contentSystemType: ContentSystemId,
  modifiers: EncounterRewardTraitId[],
): EncounterRewardTraitId[] {
  return contentSystemType === CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN ? [] : modifiers;
}

export function getGenerousGoldBonus(modifiers: EncounterRewardTraitId[], gold: number): number {
  return hasRewardModifier(modifiers, "generous")
    ? Math.floor(gold * LABYRINTH_REWARD_CONFIG.generousGoldBonusFraction)
    : 0;
}

export function applyLabyrinthRewardMaterialModifiers(
  materials: MaterialInventory,
  modifiers: EncounterRewardTraitId[],
): MaterialInventory {
  if (!hasRewardModifier(modifiers, "scavenger")) return materials;
  return {
    wood: Math.floor(materials.wood * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier),
    iron: Math.floor(materials.iron * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier),
    herbs: Math.floor(materials.herbs * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier),
    food: Math.floor(materials.food * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier),
    crystal: Math.floor(materials.crystal * LABYRINTH_REWARD_CONFIG.scavengerMaterialMultiplier),
  };
}

export function getRandomPotionCard(rng: () => number = Math.random): BattleCard {
  const potionCards = getStandardPotionPool();
  const index = Math.floor(rng() * potionCards.length);
  if (process.env.NODE_ENV !== "production" && potionCards.length === 0) {
    console.error("[reward-flow] getRandomPotionCard: no potion cards found in cardLibrary");
  }
  return potionCards[index];
}

export function getCompanionCardChoices(rng: () => number = Math.random): BattleCard[] {
  const companions = cardLibrary.filter((c) => c.effects?.some((e) => e.kind === "summon-companion"));
  return shuffle(companions, rng).slice(0, LABYRINTH_REWARD_CONFIG.companionCardChoices);
}

function getSmugglersMapGoldBonus(boonIds: string[]): number {
  return computeBoonManifest(boonIds).smugglersMapGoldBonus;
}

function sumGoldBonuses(
  bonusGold: number,
  generousBonus: number,
  talentGoldPerCombat: number,
  boonIds: string[],
): number {
  return bonusGold + generousBonus + talentGoldPerCombat + getSmugglersMapGoldBonus(boonIds);
}

export function computeRewardGold(input: RewardGoldInput): number {
  return Math.floor(
    (input.baseGold + sumGoldBonuses(input.bonusGold, input.generousBonus, input.talentGoldPerCombat, input.boonIds)) *
      input.goldMultiplier,
  );
}

export function getVictoryGoldTotal({
  battleState,
  runBoons,
  gold,
  eliteBonus,
  generousBonus,
  bossBonus,
  talentGoldPerCombat,
}: VictoryGoldTotalInput): number {
  return battleState.gold + gold + sumGoldBonuses(eliteBonus + bossBonus, generousBonus, talentGoldPerCombat, runBoons);
}

export function computeVictoryGoldResult({
  battleState,
  runGold,
  runBoons,
  gold,
  eliteBonus,
  generousBonus,
  bossBonus,
  talentGoldPerCombat,
  goldMultiplier,
}: VictoryGoldInput): VictoryGoldResult {
  const unmultipliedTotal = getVictoryGoldTotal({
    battleState,
    runBoons,
    gold,
    eliteBonus,
    generousBonus,
    bossBonus,
    talentGoldPerCombat,
  });
  const earnedBeforeMultiplier = unmultipliedTotal - runGold;
  return {
    unmultipliedTotal,
    earnedBeforeMultiplier,
    persistedRunGold: runGold + Math.floor(earnedBeforeMultiplier * goldMultiplier),
  };
}

export type FinalizeRewardRoute = (typeof CONSTANTS.REWARD_ROUTES)[keyof typeof CONSTANTS.REWARD_ROUTES];

export type FinalizeRewardInput = {
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
  grantAlchemistReward: boolean;
};

export type FinalizeRewardResult = {
  selectedChoice: BattleCard | BoonEntry | GearDefinition | null;
  selectedRewardType: RewardState["rewardType"];
  materials: MaterialInventory;
  grantAlchemistReward: boolean;
  nextRewardState: RewardState;
  clearCompanionRewardCards: boolean;
  route: FinalizeRewardRoute;
};

function resolveRewardRoute(contentSystemType: ContentSystemId, currentEnemyType: string): FinalizeRewardRoute {
  if (contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
    return currentEnemyType === CONSTANTS.ENEMY_TYPES.BOSS
      ? CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY
      : CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP;
  }
  if (contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
    return CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY;
  }
  return currentEnemyType === CONSTANTS.ENEMY_TYPES.BOSS
    ? CONSTANTS.REWARD_ROUTES.ACT_COMPLETE
    : CONSTANTS.REWARD_ROUTES.DESTINATION;
}

export function finalizeRewardState({
  rewardState,
  companionRewardCards,
  grantAlchemistReward,
}: FinalizeRewardInput): FinalizeRewardResult {
  const selectedChoice = rewardState.selectedId
    ? (rewardState.choices.find((choice) => choice.id === rewardState.selectedId) ?? null)
    : null;

  if (companionRewardCards && companionRewardCards.length > 0) {
    return {
      selectedChoice,
      selectedRewardType: rewardState.rewardType,
      materials: rewardState.materials,
      grantAlchemistReward,
      nextRewardState: {
        choices: companionRewardCards,
        gold: 0,
        materials: emptyInventory(),
        selectedId: null,
        destinations: rewardState.destinations,
        rewardType: "card",
        selectedBossId: rewardState.selectedBossId,
        lastVictoryEnemyType: rewardState.lastVictoryEnemyType,
        lastVictoryContentSystem: rewardState.lastVictoryContentSystem,
      },
      clearCompanionRewardCards: true,
      route: CONSTANTS.REWARD_ROUTES.COMPANION_REWARD,
    };
  }

  const contentSystemType = rewardState.lastVictoryContentSystem ?? CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN;
  const currentEnemyType = rewardState.lastVictoryEnemyType ?? CONSTANTS.ENEMY_TYPES.NORMAL;
  const route = resolveRewardRoute(contentSystemType, currentEnemyType);

  return {
    selectedChoice,
    selectedRewardType: rewardState.rewardType,
    materials: rewardState.materials,
    grantAlchemistReward,
    nextRewardState: createNextRewardState(rewardState),
    clearCompanionRewardCards: false,
    route,
  };
}

export type RewardRouteTransitionHandlers = {
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  completeRunVictory: (materials: MaterialInventory, onRenderedScreenCommit?: () => void) => void;
  handleActComplete: (materials: MaterialInventory) => void;
  onLabyrinthClearNode: () => void;
  setCompanionRewardCards: (cards: BattleCard[] | null) => void;
  setRewardState: (state: RewardState) => void;
};

type RewardRouteTransitionContext = {
  materials: MaterialInventory;
  nextRewardState: RewardState;
  clearCompanion: boolean;
  setReward: () => void;
};

const REWARD_ROUTE_HANDLERS: Record<
  FinalizeRewardResult["route"],
  (handlers: RewardRouteTransitionHandlers, ctx: RewardRouteTransitionContext) => void
> = {
  [CONSTANTS.REWARD_ROUTES.COMPANION_REWARD]: (handlers, { clearCompanion, setReward }) => {
    if (clearCompanion) handlers.setCompanionRewardCards(null);
    handlers.navigateTo(CONSTANTS.SCREENS.REWARDS, setReward);
  },
  [CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY]: (handlers, { materials, setReward }) => {
    handlers.completeRunVictory(materials, setReward);
  },
  [CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY]: (handlers, { materials, setReward }) => {
    handlers.completeRunVictory(materials, setReward);
  },
  [CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP]: (handlers, { setReward }) => {
    handlers.onLabyrinthClearNode();
    handlers.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP, setReward);
  },
  [CONSTANTS.REWARD_ROUTES.ACT_COMPLETE]: (handlers, { materials }) => {
    handlers.handleActComplete(materials);
  },
  [CONSTANTS.REWARD_ROUTES.DESTINATION]: (handlers, { setReward }) => {
    handlers.navigateTo(CONSTANTS.SCREENS.DESTINATION, setReward);
  },
};

export function executeRewardRouteTransition(
  route: FinalizeRewardResult["route"],
  materials: MaterialInventory,
  nextRewardState: RewardState,
  clearCompanion: boolean,
  handlers: RewardRouteTransitionHandlers,
) {
  const setReward = () => handlers.setRewardState(nextRewardState);
  REWARD_ROUTE_HANDLERS[route](handlers, { materials, nextRewardState, clearCompanion, setReward });
}

type BossRewardInput = {
  gold: number;
  bossBonus: number;
  generousBonus: number;
  talentGoldPerCombat: number;
  materials: MaterialInventory;
  boonIds: string[];
  goldMultiplier?: number;
  rng?: () => number;
};

type CombatRewardInput = {
  battleState: BattleState;
  runDeck: BattleCard[];
  gold: number;
  eliteBonus: number;
  generousBonus: number;
  talentGoldPerCombat: number;
  materials: MaterialInventory;
  destinations: Destination[];
  boonIds: string[];
  goldMultiplier?: number;
  forceBoon?: boolean;
  contentSystemType: ContentSystemId;
  rng?: () => number;
};

export function createBossRewardState({
  gold,
  bossBonus,
  generousBonus,
  talentGoldPerCombat,
  materials,
  boonIds,
  goldMultiplier = 1,
  rng = Math.random,
}: BossRewardInput): RewardState {
  const gearReward = rng() < BOSS_GEAR_REWARD_CHANCE;
  return {
    ...createEmptyRewardState(),
    rewardType: gearReward ? "gear" : "boon",
    choices: sampleItems(gearReward ? gearDefinitionList : boonLibrary, BOSS_BOON_REWARD_CHOICES, rng),
    gold: computeRewardGold({
      baseGold: gold,
      bonusGold: bossBonus,
      generousBonus,
      talentGoldPerCombat,
      boonIds,
      goldMultiplier,
    }),
    materials,
  };
}

export function createWildwoodRewardState(
  runDeck: BattleCard[],
  rewardTraitsOrRng: EncounterRewardTraitId[] | (() => number) = [],
  rng: () => number = Math.random,
): RewardState {
  const rewardTraits = typeof rewardTraitsOrRng === "function" ? [] : rewardTraitsOrRng;
  const activeRng = typeof rewardTraitsOrRng === "function" ? rewardTraitsOrRng : rng;
  const rewardType = shouldForceBoonReward(rewardTraits) || activeRng() < 0.5 ? "boon" : "card";
  return {
    ...createEmptyRewardState(),
    rewardType,
    choices:
      rewardType === "boon"
        ? sampleItems(boonLibrary, REWARD_CARD_CHOICES, activeRng)
        : selectRewardCards(runDeck, getOfferableCardPool(), REWARD_CARD_CHOICES, [], activeRng),
  };
}

export function restoreWildwoodRewardState(
  rewardType: "card" | "boon",
  choiceIds: string[],
  selectedId: string | null,
): RewardState {
  const library = rewardType === "card" ? getOfferableCardPool() : boonLibrary;
  const choices = choiceIds
    .map((id) => library.find((entry) => entry.id === id))
    .filter((entry): entry is BattleCard | BoonEntry => Boolean(entry));
  return { ...createEmptyRewardState(), rewardType, choices, selectedId };
}

function calculateCombatBoonRewardOffer(
  battleState: BattleState,
  forceBoon: boolean,
  rng: () => number = Math.random,
): boolean {
  if (forceBoon) return true;
  const baseBoonChance =
    battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE ? ELITE_BOON_REWARD_CHANCE : REWARD_BOON_CHANCE;
  const boonHoarderBonus = battleState.currentEnemy.traits?.some((t) => t.id === "boon-hoarder")
    ? LABYRINTH_REWARD_CONFIG.boonHoarderRewardChanceBonus
    : 0;
  const boonChanceBonus = battleState.talentEffects?.boonChanceBonus ?? 0;
  return rng() < Math.min(baseBoonChance + boonHoarderBonus + boonChanceBonus, 1);
}

export function createCombatRewardState({
  battleState,
  runDeck,
  gold,
  eliteBonus,
  generousBonus,
  talentGoldPerCombat,
  materials,
  destinations,
  boonIds,
  goldMultiplier = 1,
  forceBoon = false,
  contentSystemType,
  rng = Math.random,
}: CombatRewardInput): RewardState {
  const gearChance =
    contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH
      ? LABYRINTH_GEAR_REWARD_CHANCE
      : CAMPAIGN_GEAR_REWARD_CHANCE;
  const offerGear = rng() < gearChance;
  const offerBoon = !offerGear && calculateCombatBoonRewardOffer(battleState, forceBoon, rng);
  return {
    ...createEmptyRewardState(destinations),
    rewardType: offerGear ? "gear" : offerBoon ? "boon" : "card",
    choices: offerGear
      ? sampleItems(gearDefinitionList, REWARD_CARD_CHOICES, rng)
      : offerBoon
        ? sampleItems(boonLibrary, REWARD_CARD_CHOICES, rng)
        : selectRewardCards(runDeck, getOfferableCardPool(), REWARD_CARD_CHOICES, [], rng),
    gold: computeRewardGold({
      baseGold: gold,
      bonusGold: eliteBonus,
      generousBonus,
      talentGoldPerCombat,
      boonIds,
      goldMultiplier,
    }),
    materials,
  };
}
