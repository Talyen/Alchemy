// Persisted mid-run save contracts shared by validation, storage, and controllers.
import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId, TalentXP } from "@/lib/game-data";
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
import type { PersistedPendingReward } from "@/lib/validation";
import type { RunRngState } from "@/lib/run-rng";

export type { PersistedPendingReward };

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

export interface LabyrinthNodePosition {
  row: number;
  col: number;
}

interface ActiveCombatData {
  battleState: BattleState;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
  activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
}

export interface ActiveRunData {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
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
  activeCombat: ActiveCombatData | null;
  runTalentXP: TalentXP;
  runMaterialsEarned: MaterialInventory;
  currentScreen: Screen | null;
  destinationChoices: string[];
  pendingReward: PersistedPendingReward | null;
  shopState: PersistedShopState | null;
  alchemistState: PersistedAlchemistState | null;
  trinketShopState: PersistedTrinketShopState | null;
  equipmentShopState: PersistedEquipmentShopState | null;
}
