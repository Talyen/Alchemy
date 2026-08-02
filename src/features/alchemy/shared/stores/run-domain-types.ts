import type { BattleCard, CharacterId, TalentXP } from "@/lib/game-data";
import { defaultBattleState, type BattleState, type PlayerStatusValues, type TurnPhase } from "@/lib/battle";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createSeededRng } from "@/lib/utils";
import {
  createEmptyRewardState,
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyShopState,
  emptyTrinketShopState,
  type AlchemistState,
  type EquipmentShopState,
  type RewardState,
  type ShopState,
  type TrinketShopState,
} from "@/lib/active-run-session";
import {
  createInitialActiveRunFields,
  type ActiveRunProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import type { LabyrinthNodePosition, PersistedBattleTransition } from "@/lib/active-run-session";
import type { Destination, Screen } from "@/features/alchemy/shared/types";
import type {
  ContentSystemId,
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  LabyrinthMap,
} from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryEvent } from "@/lib/mystery";
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
  /**
   * In-memory only: true when a pending transition arrived via battle hydration
   * (save/boot) and must be fast-forwarded. Live `beginBattleTransition` must not
   * set this — otherwise the controller resume effect commits mid-presentation.
   */
  pendingTransitionResumeRequired: boolean;
  displayOverrides: DisplayOverrides;
  battleStartState: BattleState | null;
  hasActiveBattle: boolean;
}

/** Active-run region of the authoritative gameplay aggregate. */
export interface RunDomainDataState {
  activeRun: ActiveRunProgressFields;
  initialized: boolean;
  navigation: { screen: Screen };
}

const emptyShop: ShopState = emptyShopState();
const emptyAlchemist: AlchemistState = emptyAlchemistState();
const emptyTrinketShop: TrinketShopState = emptyTrinketShopState();
const emptyEquipmentShop: EquipmentShopState = emptyEquipmentShopState();

export function createInitialSessionFields(): RunSessionFields {
  return {
    hasActiveRun: false,
    rewardClaimInFlight: false,
    pendingDestinationClaim: null,
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
    labyrinthMap: generateLabyrinthMap(createSeededRng(0)),
    wildwoodDraft: null,
    shopState: emptyShop,
    alchemistState: emptyAlchemist,
    trinketShopState: emptyTrinketShop,
    equipmentShopState: emptyEquipmentShop,
    mysteryEvent: null,
    mysteryCardChoices: null,
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
}
