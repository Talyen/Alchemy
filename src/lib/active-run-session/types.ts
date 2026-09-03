import type { BattleState } from "@/lib/battle";
import type { CorruptionResult } from "@/lib/corruption";
import type { BattleCard, CharacterId, DifficultyId, TalentXP } from "@/lib/game-data";
import type { MysteryChoice } from "@/lib/mystery";
import type {
  ContentSystemId,
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  LabyrinthMap,
} from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Screen } from "@/lib/routing";
import type { GearInstance } from "@/lib/gear";
import type { InterruptedFlow, PersistedPendingReward } from "@/lib/validation";
import type { RunRngState } from "@/lib/rng";

import type { RefreshableShopFields } from "./shop-session-types";

export type { InterruptedFlow, PersistedPendingReward };

export type RunObtainedItem = { kind: "gear"; instance: GearInstance } | { kind: "trinket"; trinketId: string };

export interface PersistedShopState extends RefreshableShopFields {
  cards: BattleCard[];
  removeUsed: boolean;
}

export interface PersistedAlchemistState extends RefreshableShopFields {
  potions: BattleCard[];
  mixUsed: boolean;
}

export interface PersistedTrinketShopState extends RefreshableShopFields {
  trinketIds: string[];
}

export interface PersistedEquipmentShopState extends RefreshableShopFields {
  gear: GearInstance[];
}

export interface PersistedMysteryVisit {
  eventId: string;
  chosenChoice: MysteryChoice | null;

  pendingRemoval?: boolean;
  cardChoices: BattleCard[] | null;
  grantedTrinketIds: string[];
  grantedGear: GearInstance[];
  chosenCardId: string | null;
  resolvedTrinketIds: string[];
}

export type LabyrinthPendingNodeId = string;

export type PersistedBattleTransition =
  | {
      kind: "opening-draw";
      resultState: BattleState;
    }
  | {
      kind: "enemy-turn";
      resultState: BattleState;
      playerTurnSkipped: boolean;
    }
  | {
      kind: "continue-end-turn";
    }
  | {
      kind: "legacy-enemy-turn";
    };

interface ActiveCombatData {
  battleState: BattleState;
  pendingBattleTransition: PersistedBattleTransition | null;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
  activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
}

export interface ActiveRunData {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runPlayerHealth: number;
  runMaxHealth: number;

  runMetaMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: string[];
  lastOfferedDestinations: string[];
  destinationRoundsSinceOffered: Record<string, number>;
  runBoons: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
  rng: RunRngState;
  labyrinthMap: LabyrinthMap | null;
  labyrinthPendingNode: LabyrinthPendingNodeId | null;
  wildwoodDraft: WildwoodDraftState | null;

  starterDraftChoices: BattleCard[] | null;
  activeCombat: ActiveCombatData | null;
  runTalentXP: TalentXP;
  runMaterialsEarned: MaterialInventory;
  runObtainedItems: RunObtainedItem[];
  currentScreen: Screen | null;
  interruptedFlow: InterruptedFlow;
  shopState: PersistedShopState | null;
  alchemistState: PersistedAlchemistState | null;
  trinketShopState: PersistedTrinketShopState | null;
  equipmentShopState: PersistedEquipmentShopState | null;
  mysteryVisit: PersistedMysteryVisit | null;
  corruptionResult: CorruptionResult | null;
}

export type ParkedRunsMap = Partial<Record<ContentSystemId, ActiveRunData>>;
