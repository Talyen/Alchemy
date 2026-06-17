// Reward state, gold math, routing, and combat/boss reward builders.
import {
  cardLibrary,
  getOfferableCardPool,
  getStandardPotionPool,
  selectRewardCards,
  trinketLibrary,
  type BattleCard,
  type TrinketEntry,
} from "@/lib/game-data";
import { LABYRINTH_REWARD_CONFIG, REWARD_CARD_CHOICES } from "@/lib/game-constants";
import { computeTrinketManifest } from "@/lib/trinkets";
import type { MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { BattleState } from "@/lib/battle";
import { shuffle } from "@/lib/utils";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import { sampleItems } from "../../shared/utils";
import { generateGearRewardChoices, type GearInstance } from "@/lib/gear";

export type RewardStateBase = {
  gold: number;
  materials: MaterialInventory;
  selectedId: string | null;
  destinations: Destination[];
  selectedBossId: string | null;
  lastVictoryEnemyType: string | null;
  lastVictoryContentSystem: ContentSystemId | null;
};

export type CardRewardState = RewardStateBase & {
  rewardType: "card";
  choices: BattleCard[];
};

export type TrinketRewardState = RewardStateBase & {
  rewardType: "trinket";
  choices: TrinketEntry[];
};

export type GearRewardState = RewardStateBase & {
  rewardType: "gear";
  choices: GearInstance[];
};

export type RewardState = CardRewardState | TrinketRewardState | GearRewardState;

export function getRewardChoiceId(choice: BattleCard | TrinketEntry | GearInstance): string {
  return choice && typeof choice === "object" && "instanceId" in choice ? choice.instanceId : choice.id;
}

export function createEmptyRewardState(destinations: Destination[] = []): CardRewardState {
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

export function createNextRewardState(rewardState: RewardState): CardRewardState {
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
  runTrinkets: string[];
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
  trinketIds: string[];
  goldMultiplier: number;
};

function hasRewardModifier(modifiers: EncounterRewardTraitId[], kind: EncounterRewardTraitId): boolean {
  return modifiers.includes(kind);
}

function createModifierGuard(kind: EncounterRewardTraitId) {
  return (modifiers: EncounterRewardTraitId[]): boolean => hasRewardModifier(modifiers, kind);
}

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

function getSmugglersMapGoldBonus(trinketIds: string[]): number {
  return computeTrinketManifest(trinketIds).smugglersMapGoldBonus;
}

function sumGoldBonuses(
  bonusGold: number,
  generousBonus: number,
  talentGoldPerCombat: number,
  trinketIds: string[],
): number {
  return bonusGold + generousBonus + talentGoldPerCombat + getSmugglersMapGoldBonus(trinketIds);
}

export function computeRewardGold(input: RewardGoldInput): number {
  return Math.floor(
    (input.baseGold +
      sumGoldBonuses(input.bonusGold, input.generousBonus, input.talentGoldPerCombat, input.trinketIds)) *
      input.goldMultiplier,
  );
}

export function getVictoryGoldTotal({
  battleState,
  runTrinkets,
  gold,
  eliteBonus,
  generousBonus,
  bossBonus,
  talentGoldPerCombat,
}: VictoryGoldTotalInput): number {
  return (
    battleState.gold + gold + sumGoldBonuses(eliteBonus + bossBonus, generousBonus, talentGoldPerCombat, runTrinkets)
  );
}

export function computeVictoryGoldResult({
  battleState,
  runGold,
  runTrinkets,
  gold,
  eliteBonus,
  generousBonus,
  bossBonus,
  talentGoldPerCombat,
  goldMultiplier,
}: VictoryGoldInput): VictoryGoldResult {
  const unmultipliedTotal = getVictoryGoldTotal({
    battleState,
    runTrinkets,
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
  selectedChoice: BattleCard | TrinketEntry | GearInstance | null;
  selectedRewardType: RewardState["rewardType"];
  materials: MaterialInventory;
  grantAlchemistReward: boolean;
  nextRewardState: CardRewardState;
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
    ? (rewardState.choices.find((choice) => getRewardChoiceId(choice) === rewardState.selectedId) ?? null)
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
  nextRewardState: CardRewardState;
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
  nextRewardState: CardRewardState,
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
  trinketIds: string[];
  goldMultiplier?: number;
  rng?: () => number;
  gearAstralChanceBonus?: number;
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
  trinketIds: string[];
  goldMultiplier?: number;
  rng?: () => number;
};

export function createBossRewardState({
  gold,
  bossBonus,
  generousBonus,
  talentGoldPerCombat,
  materials,
  trinketIds,
  goldMultiplier = 1,
  rng = Math.random,
  gearAstralChanceBonus = 0,
}: BossRewardInput): GearRewardState {
  return {
    ...createEmptyRewardState(),
    rewardType: "gear",
    choices: generateGearRewardChoices(REWARD_CARD_CHOICES, rng, { astralChanceBonus: gearAstralChanceBonus }),
    gold: computeRewardGold({
      baseGold: gold,
      bonusGold: bossBonus,
      generousBonus,
      talentGoldPerCombat,
      trinketIds,
      goldMultiplier,
    }),
    materials,
  };
}

function rollWildwoodRewardType(rng: () => number): "card" | "trinket" | "gear" {
  const roll = Math.floor(rng() * 3);
  if (roll === 0) return "card";
  if (roll === 1) return "trinket";
  return "gear";
}

export function createWildwoodRewardState(
  runDeck: BattleCard[],
  rng: () => number = Math.random,
  gearAstralChanceBonus = 0,
): CardRewardState | TrinketRewardState | GearRewardState {
  const rewardType = rollWildwoodRewardType(rng);
  if (rewardType === "gear") {
    return {
      ...createEmptyRewardState(),
      rewardType: "gear",
      choices: generateGearRewardChoices(REWARD_CARD_CHOICES, rng, { astralChanceBonus: gearAstralChanceBonus }),
    };
  }
  if (rewardType === "trinket") {
    return {
      ...createEmptyRewardState(),
      rewardType: "trinket",
      choices: sampleItems(trinketLibrary, REWARD_CARD_CHOICES, rng),
    };
  }
  return {
    ...createEmptyRewardState(),
    rewardType: "card",
    choices: selectRewardCards(runDeck, getOfferableCardPool(), REWARD_CARD_CHOICES, [], rng),
  };
}

export function restoreWildwoodRewardState(
  rewardType: "card" | "trinket" | "gear",
  choiceIds: string[],
  selectedId: string | null,
  gearChoices: GearInstance[] = [],
): CardRewardState | TrinketRewardState | GearRewardState {
  if (rewardType === "gear") {
    return { ...createEmptyRewardState(), rewardType: "gear", choices: gearChoices, selectedId };
  }
  const library = rewardType === "card" ? getOfferableCardPool() : trinketLibrary;
  const choices = choiceIds
    .map((id) => library.find((entry) => entry.id === id))
    .filter((entry): entry is BattleCard | TrinketEntry => Boolean(entry));
  return rewardType === "card"
    ? { ...createEmptyRewardState(), rewardType: "card", choices: choices as BattleCard[], selectedId }
    : { ...createEmptyRewardState(), rewardType: "trinket", choices: choices as TrinketEntry[], selectedId };
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
  trinketIds,
  goldMultiplier = 1,
  rng = Math.random,
}: CombatRewardInput): CardRewardState | TrinketRewardState {
  const goldTotal = computeRewardGold({
    baseGold: gold,
    bonusGold: eliteBonus,
    generousBonus,
    talentGoldPerCombat,
    trinketIds,
    goldMultiplier,
  });
  if (battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE) {
    return {
      ...createEmptyRewardState(destinations),
      rewardType: "trinket",
      choices: sampleItems(trinketLibrary, REWARD_CARD_CHOICES, rng),
      gold: goldTotal,
      materials,
    };
  }
  return {
    ...createEmptyRewardState(destinations),
    rewardType: "card",
    choices: selectRewardCards(runDeck, getOfferableCardPool(), REWARD_CARD_CHOICES, [], rng),
    gold: goldTotal,
    materials,
  };
}
