// Persisted mid-run save contracts shared by validation, storage, and controllers.
import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId, TalentXP } from "@/lib/game-data";
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Screen } from "@/lib/routing";
import type { GearInstance } from "@/lib/gear";
import type { PersistedPendingReward } from "./pending-reward";

export type { PersistedPendingReward } from "./pending-reward";

export type PersistedShopState = {
  cards: BattleCard[];
  removeUsed: boolean;
  refreshesLeft: number;
  firstPurchaseUsed: boolean;
  purchasedSlotKeys: string[];
};

export type PersistedAlchemistState = {
  potions: BattleCard[];
  mixUsed: boolean;
  refreshesLeft: number;
  firstPurchaseUsed: boolean;
  purchasedSlotKeys: string[];
};

export type PersistedTrinketShopState = {
  trinketIds: string[];
  refreshesLeft: number;
  firstPurchaseUsed: boolean;
  purchasedSlotKeys: string[];
};

export type PersistedEquipmentShopState = {
  gear: GearInstance[];
  refreshesLeft: number;
  firstPurchaseUsed: boolean;
  purchasedSlotKeys: string[];
};

export type LabyrinthNodePosition = { row: number; col: number };

type ActiveCombatData = {
  battleState: BattleState;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
};

export type ActiveRunData = {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: string[];
  runTrinkets: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
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
};

export type DestinationOptionsInput = {
  currentHealth?: number;
  currentGold?: number;
  destinationIndexInAct?: number;
  maxHealth?: number;
};
