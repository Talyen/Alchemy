// Exact display contracts for run-loop and run-end screens.
// Each screen owns the smallest read model it needs; there is intentionally no
// all-screens field bag because absent fields must be a type error, not undefined.
import type { BattleCard, TalentXP } from "@/lib/game-data";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";
import type { GearInstance } from "@/lib/gear";
import type { MaterialInventory } from "@/lib/homestead/types";
import type {
  AlchemistState,
  EquipmentShopState,
  RewardState,
  ShopState,
  TrinketShopState,
} from "@/lib/active-run-session";

interface CampfireScreenData {
  runPlayerHealth: number;
  runMaxHealth: number;
}

interface ShopScreenData {
  runGold: number;
  runDeck: BattleCard[];
  shopState: ShopState;
}

interface AlchemistScreenData {
  runGold: number;
  runDeck: BattleCard[];
  alchemistState: AlchemistState;
}

interface TrinketShopScreenData {
  runGold: number;
  trinketShopState: TrinketShopState;
}

interface EquipmentShopScreenData {
  runGold: number;
  equipmentShopState: EquipmentShopState;
}

interface LabyrinthMapScreenData {
  labyrinthMap: LabyrinthMap;
}

interface RewardsScreenData {
  rewardState: RewardState;
  rewardClaimInFlight: boolean;
}

interface DestinationScreenData {
  rewardState: RewardState;
}

interface MysteryScreenData {
  mysteryEvent: MysteryEvent | null;
  mysteryCardChoices: BattleCard[] | null;
  mysteryGrantedTrinketIds: string[];
  mysteryGrantedGearInstances: GearInstance[];
  mysteryChosenCardId: string | null;
  mysteryChosenChoice: MysteryChoice | null;
  mysteryPendingRemoval: boolean;
  runDeck: BattleCard[];
  runTalentXP: TalentXP;
  talentXP: TalentXP;
}

interface CorruptionScreenData {
  runDeck: BattleCard[];
  corruptionResult: CorruptionResult | null;
}

interface RunEndScreenData {
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
}

interface WildwoodRemovalScreenData {
  runDeck: BattleCard[];
}

/** Exact screen-to-data mapping used by typed route read hooks. */
export interface RunScreenDataByScreen {
  campfire: CampfireScreenData;
  shop: ShopScreenData;
  alchemist: AlchemistScreenData;
  "trinket-shop": TrinketShopScreenData;
  "equipment-shop": EquipmentShopScreenData;
  "labyrinth-map": LabyrinthMapScreenData;
  rewards: RewardsScreenData;
  destination: DestinationScreenData;
  mystery: MysteryScreenData;
  corruption: CorruptionScreenData;
  "game-over": RunEndScreenData;
  "run-victory": RunEndScreenData;
  "wildwood-removal": WildwoodRemovalScreenData;
}

export type RunDataScreen = keyof RunScreenDataByScreen;
