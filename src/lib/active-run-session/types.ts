import type { AlchemyVisit } from "./alchemy-visits";
import type { BattleSnapshot } from "@/lib/battle";
import type {
  ContentSystemId,
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  LabyrinthMap,
} from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { CorruptionResult } from "@/lib/corruption";
import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";
import type { Destination } from "@/lib/routing";
import type { PersistedPendingReward, PersistedRunProgress } from "@/lib/validation";

import type { AlchemistState, EquipmentShopState, RefreshableShopFields, ShopState } from "./shop-session-types";

export type { PersistedPendingReward };

export type RunObtainedItem = { kind: "gear"; instance: GearInstance } | { kind: "trinket"; trinketId: string };

export type PersistedShopState = ShopState;

export type PersistedAlchemistState = AlchemistState;

export interface PersistedTrinketShopState extends RefreshableShopFields {
  trinketIds: string[];
}

export type PersistedEquipmentShopState = EquipmentShopState;

export interface PersistedMysteryVisit {
  event: MysteryEvent;
  chosenChoice: MysteryChoice | null;
  cardChoices: BattleCard[] | null;
  grantedTrinketIds: string[];
  grantedGear: GearInstance[];
  chosenCardId: string | null;
}

export type LabyrinthPendingNodeId = string;

export type PersistedRunActivity =
  | { kind: "battle"; data: { battleState: BattleSnapshot } }
  | { kind: "rewards"; data: PersistedPendingReward }
  | {
      kind: "destination";
      data: {
        destinations: Destination[];
        selectedBossId: string | null;
        lastVictoryEnemyType: import("@/lib/game-data").EnemyType | null;
        lastVictoryContentSystem: ContentSystemId | null;
      };
    }
  | { kind: "shop"; data: PersistedShopState }
  | { kind: "alchemist"; data: PersistedAlchemistState }
  | { kind: "trinket-shop"; data: PersistedTrinketShopState }
  | { kind: "equipment-shop"; data: PersistedEquipmentShopState }
  | { kind: "mystery"; data: PersistedMysteryVisit | null }
  | { kind: "corruption"; data: CorruptionResult | null }
  | { kind: "campfire"; data: AlchemyVisit }
  | { kind: "transmutation"; data: AlchemyVisit }
  | { kind: "draft-deck" }
  | { kind: "difficulty-select" }
  | { kind: "labyrinth-map" }
  | { kind: "wildwood-removal" };

export interface RunRecap {
  mode: ContentSystemId;
  rooms: PersistedRunProgress["runHistory"];
  partial: boolean;
  ending: "death" | "abandoned" | "victory";
  endingRoomId: string | null;
  deck: BattleCard[];
  boons: string[];
  gold: number | null;
}
export interface ActiveRunData extends PersistedRunProgress {
  labyrinthMap: LabyrinthMap | null;
  labyrinthPendingNode: LabyrinthPendingNodeId | null;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
  activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
  wildwoodDraft: WildwoodDraftState | null;
  starterDraftChoices: BattleCard[] | null;
  activity: PersistedRunActivity;
}
