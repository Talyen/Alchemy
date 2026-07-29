// Screen-scoped display field bag for run-loop / run-end routes.
// Production reads use selective store picks via useRunScreenData — this type is the shared field contract.
import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryEvent } from "@/lib/mystery";
import type { MaterialInventory } from "@/lib/homestead/types";
import type {
  AlchemistState,
  EquipmentShopState,
  RewardState,
  ShopState,
  TrinketShopState,
} from "@/lib/active-run-session";

export interface RunScreenData {
  runPlayerHealth: number;
  runMaxHealth: number;
  runGold: number;
  runDeck: BattleCard[];
  selectedDifficulty: DifficultyId | null;
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  runTalentXP: TalentXP;
  runEndTalentXP: TalentXP;
  hasActiveRun: boolean;
  hasActiveBattle: boolean;
  battleState: BattleState;
  rewardState: RewardState;
  labyrinthMap: LabyrinthMap;
  mysteryEvent: MysteryEvent | null;
  mysteryCardChoices: BattleCard[] | null;
  corruptionResult: CorruptionResult | null;
  shopState: ShopState;
  alchemistState: AlchemistState;
  trinketShopState: TrinketShopState;
  equipmentShopState: EquipmentShopState;
  runEndMaterials: MaterialInventory;
  pendingCharacterId: CharacterId | null;
}
