// Reward state, gold math, routing, and combat/boss reward builders.
import {
  cardLibrary,
  getOfferableCardPool,
  getStandardPotionPool,
  trinketLibrary,
  type BattleCard,
  type TrinketEntry,
} from "@/lib/game-data";
import {
  BOSS_TRINKET_REWARD_CHOICES,
  ELITE_TRINKET_REWARD_CHANCE,
  LABYRINTH_REWARD_CONFIG,
  REWARD_CARD_CHOICES,
  REWARD_TRINKET_CHANCE,
} from "@/lib/game-constants";
import { computeTrinketManifest } from "@/lib/trinkets";
import type { MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { BattleState } from "@/lib/battle";
import { shuffle } from "@/lib/utils";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";
import type { ContentSystemId, LabyrinthModifierKind } from "@/lib/content-systems/types";
import { sampleItems } from "../../shared/utils";
import { selectRewardCards } from "../reward-utils";

export type RewardState = {
  choices: (BattleCard | TrinketEntry)[];
  gold: number;
  materials: MaterialInventory;
  selectedId: string | null;
  destinations: Destination[];
  rewardType: "card" | "trinket";
  selectedBossId: string | null;
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
  };
}

export function createNextRewardState(rewardState: RewardState): RewardState {
  return { ...createEmptyRewardState(rewardState.destinations), selectedBossId: rewardState.selectedBossId };
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

function hasRewardModifier(modifiers: LabyrinthModifierKind[], kind: LabyrinthModifierKind): boolean {
  return modifiers.includes(kind);
}

function createModifierGuard(kind: LabyrinthModifierKind) {
  return (modifiers: LabyrinthModifierKind[]): boolean => hasRewardModifier(modifiers, kind);
}

export const shouldForceTrinketReward = createModifierGuard("collector");
export const shouldGrantCompanionReward = createModifierGuard("companion");
export const shouldGrantAlchemistReward = createModifierGuard("alchemist");

export function getActiveRewardModifiersForContentSystem(
  contentSystemType: ContentSystemId,
  modifiers: LabyrinthModifierKind[],
): LabyrinthModifierKind[] {
  return contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH ? modifiers : [];
}

export function getGenerousGoldBonus(modifiers: LabyrinthModifierKind[], gold: number): number {
  return hasRewardModifier(modifiers, "generous")
    ? Math.floor(gold * LABYRINTH_REWARD_CONFIG.generousGoldBonusFraction)
    : 0;
}

export function applyLabyrinthRewardMaterialModifiers(
  materials: MaterialInventory,
  modifiers: LabyrinthModifierKind[],
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

type FinalizeRewardRoute =
  | "companion-reward"
  | "labyrinth-victory"
  | "labyrinth-map"
  | "wildwood-victory"
  | "act-complete"
  | "destination";

export type FinalizeRewardInput = {
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
  contentSystemType: ContentSystemId;
  currentEnemyType: string;
  grantAlchemistReward: boolean;
};

export type FinalizeRewardResult = {
  selectedChoice: BattleCard | TrinketEntry | null;
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
  contentSystemType,
  currentEnemyType,
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
      },
      clearCompanionRewardCards: true,
      route: CONSTANTS.REWARD_ROUTES.COMPANION_REWARD,
    };
  }

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
  trinketIds: string[];
  goldMultiplier?: number;
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
  forceTrinket?: boolean;
};

export function createBossRewardState({
  gold,
  bossBonus,
  generousBonus,
  talentGoldPerCombat,
  materials,
  trinketIds,
  goldMultiplier = 1,
}: BossRewardInput): RewardState {
  return {
    rewardType: "trinket",
    choices: sampleItems(trinketLibrary, BOSS_TRINKET_REWARD_CHOICES),
    gold: computeRewardGold({
      baseGold: gold,
      bonusGold: bossBonus,
      generousBonus,
      talentGoldPerCombat,
      trinketIds,
      goldMultiplier,
    }),
    materials,
    selectedId: null,
    destinations: [],
    selectedBossId: null,
  };
}

function calculateCombatTrinketRewardOffer(
  battleState: BattleState,
  forceTrinket: boolean,
  rng: () => number = Math.random,
): boolean {
  if (forceTrinket) return true;
  const baseTrinketChance =
    battleState.currentEnemy.enemyType === CONSTANTS.ENEMY_TYPES.ELITE
      ? ELITE_TRINKET_REWARD_CHANCE
      : REWARD_TRINKET_CHANCE;
  const trinketHoarderBonus = battleState.currentEnemy.traits?.some((t) => t.id === "trinket-hoarder")
    ? LABYRINTH_REWARD_CONFIG.trinketHoarderRewardChanceBonus
    : 0;
  const trinketChanceBonus = battleState.talentEffects?.trinketChanceBonus ?? 0;
  return rng() < Math.min(baseTrinketChance + trinketHoarderBonus + trinketChanceBonus, 1);
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
  forceTrinket = false,
}: CombatRewardInput): RewardState {
  const offerTrinket = calculateCombatTrinketRewardOffer(battleState, forceTrinket);
  return {
    rewardType: offerTrinket ? "trinket" : "card",
    choices: offerTrinket
      ? sampleItems(trinketLibrary, REWARD_CARD_CHOICES)
      : selectRewardCards(runDeck, getOfferableCardPool(), REWARD_CARD_CHOICES),
    gold: computeRewardGold({
      baseGold: gold,
      bonusGold: eliteBonus,
      generousBonus,
      talentGoldPerCombat,
      trinketIds,
      goldMultiplier,
    }),
    materials,
    selectedId: null,
    destinations,
    selectedBossId: null,
  };
}
