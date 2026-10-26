import {
  createInitialActiveRunFields,
  type ActiveRunProgressFields,
} from "@/features/alchemy/shared/stores/session/run-state-init";
import {
  type LabyrinthPendingNodeId,
  type DestinationActivityData,
  type RunActivity,
  type RunObtainedItem,
  type RunRecap,
} from "@/lib/active-run-session";
import type {
  ContentSystemId,
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  LabyrinthMap,
} from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { BattleCard, CharacterId, TalentXP } from "@/lib/game-data";
import { EMPTY_CRAFTING_CURRENCIES, type CraftingCurrencyId } from "@/lib/gear";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Destination, Screen } from "@/lib/routing";

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
    progressClaim: { kind: "idle" },
    runEndMaterials: emptyInventory(),
    runEndCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
    runEndTalentXP: {},
    runEndItems: [],
    runEndUnlockedCharacters: [],
    runRecap: null,
    pendingCharacterId: null,
    pendingContentSystemType: "campaign",
    labyrinthMap: null,
    wildwoodDraft: null,
    starterDraftChoices: null,
  };
}

export function createInitialRunDomainData(generateSeed?: () => number): RunDomainDataState {
  return {
    activeRun: createInitialActiveRunFields(null, "knight", generateSeed),
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
  progressClaim: ProgressClaim;
  runEndMaterials: MaterialInventory;
  runEndCurrencies: Record<CraftingCurrencyId, number>;
  runEndTalentXP: TalentXP;
  runEndItems: RunObtainedItem[];
  runEndUnlockedCharacters: CharacterId[];
  runRecap: RunRecap | null;
  pendingCharacterId: CharacterId | null;
  pendingContentSystemType: ContentSystemId;
  labyrinthMap: LabyrinthMap | null;
  wildwoodDraft: WildwoodDraftState | null;
  starterDraftChoices: BattleCard[] | null;
}

/** Claim authority outlives activity replacement until navigation finishes. */
type ProgressClaim =
  | { kind: "idle" }
  | { kind: "reward" }
  | { kind: "destination"; destination: Destination; offer: DestinationActivityData };
