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
import { battleSnapshot, defaultBattleState, type BattleSnapshot } from "@/lib/battle";
import type {
  ContentSystemId,
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  LabyrinthMap,
} from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { BattleCard, CharacterId, TalentXP } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { EMPTY_CRAFTING_CURRENCIES, type CraftingCurrencyId } from "@/lib/gear";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Destination, Screen } from "@/lib/routing";

export interface RunDomainBattleState {
  battleState: BattleSnapshot;
  pendingBattleTransition: PersistedBattleTransition | null;

  pendingTransitionResumeRequired: boolean;
  battleStartState: BattleSnapshot | null;
  hasActiveBattle: boolean;
}

export interface RunDomainDataState {
  activeRun: ActiveRunProgressFields;
  initialized: boolean;
  navigation: { screen: Screen };
}

export function createInitialSessionFields(): RunSessionFields {
  return {
    activity: { kind: "inactive" },

    activeLabyrinthModifiers: [],
    activeLabyrinthRewardModifiers: [],
    activeLabyrinthPendingNode: null,
    selectedLabyrinthNodeId: null,
    runEndLabyrinthFloor: null,
    rewardFlow: { state: createEmptyRewardState(), companionCards: null, claim: { kind: "idle" } },
    runEndMaterials: emptyInventory(),
    runEndCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
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
    battleState: battleSnapshot(defaultBattleState()),
    pendingBattleTransition: null,
    pendingTransitionResumeRequired: false,
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
  activity: RunActivity;

  activeLabyrinthModifiers: EncounterCombatTraitId[];
  activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
  activeLabyrinthPendingNode: LabyrinthPendingNodeId | null;
  selectedLabyrinthNodeId: string | null;
  runEndLabyrinthFloor: number | null;
  rewardFlow: RunRewardFlow;
  runEndMaterials: MaterialInventory;
  runEndCurrencies: Record<CraftingCurrencyId, number>;
  runEndTalentXP: TalentXP;
  runEndItems: RunObtainedItem[];
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
  labyrinthMap: LabyrinthMap | null;
  wildwoodDraft: WildwoodDraftState | null;
  starterDraftChoices: BattleCard[] | null;
}

export interface RunRewardFlow {
  state: RewardState;
  companionCards: BattleCard[] | null;
  claim: { kind: "idle" } | { kind: "reward" } | { kind: "destination"; destination: Destination };
}
