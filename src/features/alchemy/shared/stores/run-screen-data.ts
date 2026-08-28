import type { BattleCard, CharacterId, TalentXP } from "@/lib/game-data";
import type { LabyrinthMap } from "@/lib/content-systems/types";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";
import type { GearInstance } from "@/lib/gear";
import type { RunObtainedItem } from "@/lib/active-run-session";
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
  gold: number;
  runDeck: BattleCard[];
  shopState: ShopState;
}

interface AlchemistScreenData {
  gold: number;
  runDeck: BattleCard[];
  alchemistState: AlchemistState;
}

interface TrinketShopScreenData {
  gold: number;
  trinketShopState: TrinketShopState;
}

interface EquipmentShopScreenData {
  gold: number;
  equipmentShopState: EquipmentShopState;
}

interface LabyrinthMapScreenData {
  labyrinthMap: LabyrinthMap;
  selectedLabyrinthNodeId: string | null;
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
  characterId: CharacterId;
  runEndTalentXP: TalentXP;
  talentXP: TalentXP;
  runEndMaterials: MaterialInventory;
  runEndItems: RunObtainedItem[];
  runEndLabyrinthFloor: number | null;
}

interface WildwoodRemovalScreenData {
  runDeck: BattleCard[];
}

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
