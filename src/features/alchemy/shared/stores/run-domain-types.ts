import type { BattleCard, CharacterId, TalentXP } from "@/lib/game-data";
import { defaultBattleState, type BattleState, type PlayerStatusValues, type TurnPhase } from "@/lib/battle";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
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
  createInitialProgressState,
  createInitialTalentState,
  type ActiveRunProgressFields,
  type PermanentProgressFields,
  type ProgressState,
} from "@/features/alchemy/run-setup/run/run-state-init";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import type { Destination, Screen } from "@/features/alchemy/shared/types";
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
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
  displayOverrides: DisplayOverrides;
  battleStartState: BattleState | null;
  hasActiveBattle: boolean;
}

export interface RunDomainDataState {
  activeRun: ActiveRunProgressFields;
  profile: PermanentProgressFields;
  initialized: boolean;
  session: RunSessionFields;
  navigation: { screen: Screen };
  battle: RunDomainBattleState;
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

export function createInitialProgressFields(): ProgressState {
  const progress = createInitialProgressState(null);
  return {
    ...progress,
    permanent: {
      ...progress.permanent,
      ...createInitialTalentState({}, {}),
    },
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
  const progress = createInitialProgressFields();
  return {
    activeRun: progress.run,
    profile: progress.permanent,
    initialized: progress.initialized,
    session: createInitialSessionFields(),
    navigation: { screen: "menu" },
    battle: createInitialBattleFields(),
  };
}

export interface RunSessionFields {
  hasActiveRun: boolean;
  rewardClaimInFlight: boolean;
  pendingDestinationClaim: Destination | null;
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
}
