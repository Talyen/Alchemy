import type { BattleCard, CharacterId, TalentXP } from "@/lib/game-data";
import { defaultBattleState, type BattleState, type PlayerStatusValues, type TurnPhase } from "@/lib/battle";
import {
  createEmptyRewardState,
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyShopState,
  emptyTrinketShopState,
  type AlchemistState,
  type EquipmentShopState,
  type LabyrinthPendingNodeId,
  type PersistedBattleTransition,
  type RewardState,
  type RunObtainedItem,
  type ShopState,
  type TrinketShopState,
} from "@/lib/active-run-session";
import type { GearInstance } from "@/lib/gear";
import {
  createInitialActiveRunFields,
  type ActiveRunProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import type { Destination, Screen } from "@/lib/routing";
import type {
  ContentSystemId,
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  LabyrinthMap,
} from "@/lib/content-systems/types";
import { emptyParkedRuns, type ParkedRunsMap } from "./parked-runs";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { CorruptionResult } from "@/lib/corruption";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";
import type { MaterialInventory } from "@/lib/homestead/types";

export interface DisplayOverrides {
  hand?: BattleCard[];
  turnPhase?: TurnPhase;
  playerHealth?: number;
  playerStatuses?: PlayerStatusValues;
}

export interface RunDomainBattleState {
  battleState: BattleState;
  pendingBattleTransition: PersistedBattleTransition | null;

  pendingTransitionResumeRequired: boolean;
  displayOverrides: DisplayOverrides;
  battleStartState: BattleState | null;
  hasActiveBattle: boolean;
}

export interface RunDomainDataState {
  activeRun: ActiveRunProgressFields;
  parkedRuns: ParkedRunsMap;
  runRecency: ContentSystemId[];
  initialized: boolean;
  navigation: { screen: Screen };
}

export function createInitialSessionFields(): RunSessionFields {
  return {
    hasActiveRun: false,
    rewardClaimInFlight: false,
    pendingDestinationClaim: null,
    activeLabyrinthModifiers: [],
    activeLabyrinthRewardModifiers: [],
    activeLabyrinthPendingNode: null,
    selectedLabyrinthNodeId: null,
    runEndLabyrinthFloor: null,
    rewardState: createEmptyRewardState(),
    companionRewardCards: null,
    runEndMaterials: emptyInventory(),
    runEndTalentXP: {},
    runEndItems: [],
    corruptionResult: null,
    pendingCharacterId: null,
    pendingContentSystemType: "campaign",
    labyrinthMap: null,
    wildwoodDraft: null,
    starterDraftChoices: null,
    shopState: emptyShopState(),
    alchemistState: emptyAlchemistState(),
    trinketShopState: emptyTrinketShopState(),
    equipmentShopState: emptyEquipmentShopState(),
    mysteryEvent: null,
    mysteryChosenChoice: null,
    mysteryPendingRemoval: false,
    mysteryCardChoices: null,
    mysteryGrantedTrinketIds: [],
    mysteryGrantedGearInstances: [],
    mysteryChosenCardId: null,
  };
}

export function createInitialBattleFields(): RunDomainBattleState {
  return {
    battleState: defaultBattleState(),
    pendingBattleTransition: null,
    pendingTransitionResumeRequired: false,
    displayOverrides: {},
    battleStartState: null,
    hasActiveBattle: false,
  };
}

export function createInitialRunDomainData(): RunDomainDataState {
  return {
    activeRun: createInitialActiveRunFields(null),
    parkedRuns: emptyParkedRuns(),
    runRecency: [],
    initialized: false,
    navigation: { screen: "menu" },
  };
}

export interface RunSessionFields {
  hasActiveRun: boolean;
  rewardClaimInFlight: boolean;
  pendingDestinationClaim: Destination | null;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
  activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
  activeLabyrinthPendingNode: LabyrinthPendingNodeId | null;
  selectedLabyrinthNodeId: string | null;
  runEndLabyrinthFloor: number | null;
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
  runEndMaterials: MaterialInventory;
  runEndTalentXP: TalentXP;
  runEndItems: RunObtainedItem[];
  corruptionResult: CorruptionResult | null;
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
  labyrinthMap: LabyrinthMap | null;
  wildwoodDraft: WildwoodDraftState | null;
  starterDraftChoices: BattleCard[] | null;
  shopState: ShopState;
  alchemistState: AlchemistState;
  trinketShopState: TrinketShopState;
  equipmentShopState: EquipmentShopState;
  mysteryEvent: MysteryEvent | null;
  mysteryChosenChoice: MysteryChoice | null;

  mysteryPendingRemoval: boolean;
  mysteryCardChoices: BattleCard[] | null;

  mysteryGrantedTrinketIds: string[];

  mysteryGrantedGearInstances: GearInstance[];

  mysteryChosenCardId: string | null;
}
