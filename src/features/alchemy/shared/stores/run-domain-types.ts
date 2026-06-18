// Types and initial state for the consolidated run domain store.
import type { BattleCard, CharacterId, DifficultyId, KeywordId, UnlockedTalents, TalentXP } from "@/lib/game-data";
import { defaultBattleState, type BattleState, type PlayerStatusValues, type TurnPhase } from "@/lib/battle";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createEmptyRewardState, type RewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import type {
  ShopState,
  AlchemistState,
  TrinketShopState,
  EquipmentShopState,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyShopState,
  emptyTrinketShopState,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  createInitialRunState,
  createInitialTalentState,
  type RunStateFields,
} from "@/features/alchemy/run-setup/run/run-state-init";
import type { ActiveRunData, LabyrinthNodePosition } from "@/lib/active-run-session";
import type { RunStartSnapshot } from "@/features/alchemy/run-setup/run/run-start";
import type { Destination, Screen } from "@/features/alchemy/shared/types";
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryEvent } from "@/lib/mystery";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Setter } from "@/lib/utils";

export type NavigationStore = {
  screen: Screen;
  setScreen: Setter<Screen>;
  reset: () => void;
};

export type DisplayOverrides = {
  /** Shallow-merged via `{ ...battleState, ...displayOverrides }`. Only use top-level primitive fields. */
  hand?: BattleCard[];
  turnPhase?: TurnPhase;
  playerHealth?: number;
  playerStatuses?: PlayerStatusValues;
};

export type RunDomainBattleState = {
  battleState: BattleState;
  displayOverrides: DisplayOverrides;
  battleStartState: BattleState | null;
  hasActiveBattle: boolean;
};

type RunDomainNavigationState = {
  screen: Screen;
};

export type RunDomainDataState = {
  progress: RunStateFields;
  session: RunSessionFields;
  navigation: RunDomainNavigationState;
  battle: RunDomainBattleState;
};

const emptyShop: ShopState = emptyShopState();
const emptyAlchemist: AlchemistState = emptyAlchemistState();
const emptyTrinketShop: TrinketShopState = emptyTrinketShopState();
const emptyEquipmentShop: EquipmentShopState = emptyEquipmentShopState();

export function createInitialSessionFields(): RunSessionFields {
  return {
    hasActiveRun: false,
    activeLabyrinthModifiers: [],
    activeLabyrinthRewardModifiers: [],
    activeLabyrinthPendingNode: null,
    rewardState: createEmptyRewardState(),
    companionRewardCards: null,
    runEndMaterials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
    runEndTalentXP: {},
    corruptionResult: null,
    pendingCharacterId: null,
    pendingContentSystemType: "campaign",
    labyrinthMap: generateLabyrinthMap(),
    wildwoodDraft: null,
    shopState: emptyShop,
    alchemistState: emptyAlchemist,
    trinketShopState: emptyTrinketShop,
    equipmentShopState: emptyEquipmentShop,
    mysteryEvent: null,
    mysteryCardChoices: null,
  };
}

export function createInitialProgressFields(): RunStateFields {
  return {
    ...createInitialRunState(null),
    ...createInitialTalentState({}, {}),
  };
}

export function createInitialBattleFields(): RunDomainBattleState {
  return {
    battleState: defaultBattleState(),
    displayOverrides: {},
    battleStartState: null,
    hasActiveBattle: false,
  };
}

export function createInitialRunDomainData(): RunDomainDataState {
  return {
    progress: createInitialProgressFields(),
    session: createInitialSessionFields(),
    navigation: { screen: "menu" },
    battle: createInitialBattleFields(),
  };
}

export type RunSessionFields = {
  hasActiveRun: boolean;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  activeLabyrinthPendingNode: LabyrinthNodePosition | null;
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
  runEndMaterials: MaterialInventory;
  runEndTalentXP: TalentXP;
  corruptionResult: CorruptionResult | null;
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
  labyrinthMap: LabyrinthMap;
  wildwoodDraft: WildwoodDraftState | null;
  shopState: ShopState;
  alchemistState: AlchemistState;
  trinketShopState: TrinketShopState;
  equipmentShopState: EquipmentShopState;
  mysteryEvent: MysteryEvent | null;
  mysteryCardChoices: BattleCard[] | null;
};

type RunSessionActions = {
  setHasActiveRun: (active: boolean) => void;
  setActiveLabyrinthModifiers: (modifiers: LabyrinthModifierKind[]) => void;
  setActiveLabyrinthRewardModifiers: (modifiers: LabyrinthModifierKind[]) => void;
  setActiveLabyrinthPendingNode: (node: LabyrinthNodePosition | null) => void;
  setRewardState: Setter<RewardState>;
  setCompanionRewardCards: (cards: BattleCard[] | null) => void;
  setRunEndMaterials: (materials: MaterialInventory) => void;
  setRunEndTalentXP: (xp: TalentXP) => void;
  setCorruptionResult: (result: CorruptionResult | null) => void;
  setPendingCharacterId: (id: CharacterId | null) => void;
  setPendingContentSystemType: (type: ContentSystemId) => void;
  setLabyrinthMap: Setter<LabyrinthMap>;
  setWildwoodDraft: Setter<WildwoodDraftState | null>;
  setShopState: Setter<ShopState>;
  setAlchemistState: Setter<AlchemistState>;
  setTrinketShopState: Setter<TrinketShopState>;
  setEquipmentShopState: Setter<EquipmentShopState>;
  setMysteryEvent: (event: MysteryEvent | null) => void;
  setMysteryCardChoices: (choices: BattleCard[] | null | ((prev: BattleCard[] | null) => BattleCard[] | null)) => void;
  clearTransientSession: () => void;
};

export type RunSessionStore = RunSessionFields & RunSessionActions;

type RunProgressActions = {
  setRunDeck: Setter<BattleCard[]>;
  setRunGold: Setter<number>;
  setRunPlayerHealth: Setter<number>;
  setRunMaxHealth: Setter<number>;
  setRoomsEncountered: Setter<number>;
  setCurrentAct: Setter<number>;
  setDestinationIndexInAct: Setter<number>;
  setCompletedDestinations: Setter<Destination[]>;
  setLastOfferedDestinations: Setter<Destination[]>;
  setDestinationRoundsSinceOffered: Setter<Partial<Record<Destination, number>>>;
  setDestinationOfferState: (state: {
    lastOfferedDestinations: Destination[];
    roundsSinceOffered: Partial<Record<Destination, number>>;
  }) => void;
  setRunTrinkets: Setter<string[]>;
  setEncounteredRunEnemyIds: Setter<string[]>;
  setSelectedDifficulty: Setter<DifficultyId | null>;
  setContentSystemType: Setter<ContentSystemId>;
  setCharacter: (selectedId: CharacterId) => void;
  reset: () => void;
  addRunGold: (amount: number) => void;
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  resetRunXP: () => void;
  clearPermanentData: () => void;
  awardCardXP: (card: BattleCard) => void;
  awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
  addRunMaterialsEarned: (materials: MaterialInventory) => void;
  clearRunMaterialsEarned: () => void;
  finalizeRunXP: () => void;
  initialize: (
    activeRun: ActiveRunData | null,
    talentXP: TalentXP,
    unlockedTalents: UnlockedTalents,
    fallbackCharacterId?: CharacterId,
  ) => void;
  hydrateFromSnapshot: (snapshot: RunStartSnapshot) => void;
};

export type RunProgressStore = RunStateFields & RunProgressActions;
