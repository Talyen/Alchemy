import {
  createInitialActiveRunFields,
  type ActiveRunProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import {
  createEmptyRewardState,
  type LabyrinthPendingNodeId,
  type PersistedBattleTransition,
  type RewardState,
  type RunActivity,
  type RunObtainedItem,
} from "@/lib/active-run-session";
import { defaultBattleState, type BattleState, type PlayerStatusValues, type TurnPhase } from "@/lib/battle";
import type {
  ContentSystemId,
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  LabyrinthMap,
} from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { BattleCard, CharacterId, TalentXP } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Destination, Screen } from "@/lib/routing";
import { emptyParkedRuns, type ParkedRunsMap } from "./parked-runs";

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
    activity: { kind: "idle" },
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
    pendingCharacterId: null,
    pendingContentSystemType: "campaign",
    labyrinthMap: null,
    wildwoodDraft: null,
    starterDraftChoices: null,
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
  activity: RunActivity;
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
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
  labyrinthMap: LabyrinthMap | null;
  wildwoodDraft: WildwoodDraftState | null;
  starterDraftChoices: BattleCard[] | null;
}
