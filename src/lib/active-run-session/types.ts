// Persisted mid-run save contracts shared by validation, storage, and controllers.
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
import type { RunRngState } from "@/lib/run-rng";

export type { InterruptedFlow, PersistedPendingReward };

export interface PersistedShopState {
  cards: BattleCard[];
  removeUsed: boolean;
  refreshesLeft: number;
  firstPurchaseUsed: boolean;
  purchasedSlotKeys: string[];
}

export interface PersistedAlchemistState {
  potions: BattleCard[];
  mixUsed: boolean;
  refreshesLeft: number;
  firstPurchaseUsed: boolean;
  purchasedSlotKeys: string[];
}

export interface PersistedTrinketShopState {
  trinketIds: string[];
  refreshesLeft: number;
  firstPurchaseUsed: boolean;
  purchasedSlotKeys: string[];
}

export interface PersistedEquipmentShopState {
  gear: GearInstance[];
  refreshesLeft: number;
  firstPurchaseUsed: boolean;
  purchasedSlotKeys: string[];
}

export interface PersistedMysteryVisit {
  eventId: string;
  chosenChoice: MysteryChoice | null;
  pendingRemoval: boolean;
  cardChoices: BattleCard[] | null;
  grantedTrinketIds: string[];
  grantedGear: GearInstance[];
  chosenCardId: string | null;
  resolvedTrinketIds: string[];
}

export interface LabyrinthNodePosition {
  row: number;
  col: number;
}

export type PersistedBattleTransition =
  | {
      kind: "enemy-turn";
      resultState: BattleState;
      playerTurnSkipped: boolean;
    }
  | {
      kind: "continue-end-turn";
    }
  | {
      /** Recovery marker for enemy-phase saves without a persisted continuation. */
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
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  /** Derived max HP from current meta when this snapshot was written; combat bonuses are runMaxHealth minus this. */
  runMetaMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: string[];
  lastOfferedDestinations: string[];
  destinationRoundsSinceOffered: Record<string, number>;
  runTrinkets: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
  rng: RunRngState;
  labyrinthMap: LabyrinthMap | null;
  labyrinthPendingNode: LabyrinthNodePosition | null;
  wildwoodDraft: WildwoodDraftState | null;
  /** Campaign/labyrinth Wildcard pick set; null when the starter draft is finished or unused. */
  starterDraftChoices: BattleCard[] | null;
  activeCombat: ActiveCombatData | null;
  runTalentXP: TalentXP;
  runMaterialsEarned: MaterialInventory;
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
