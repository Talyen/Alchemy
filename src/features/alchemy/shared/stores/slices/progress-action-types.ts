import type { ActiveRunData } from "@/lib/active-run-session";
import type { BattleCard, CharacterId, KeywordId } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { ActiveRunProgressFields } from "@/features/alchemy/shared/stores/run-state-init";
import type { RunRngStream } from "@/lib/run-rng";

/** Active-run scoped progression actions. Permanent progression lives on run-profile-store. */
export interface ProgressActions {
  setRunDeck: (action: BattleCard[] | ((prev: BattleCard[]) => BattleCard[])) => void;
  setRunGold: (action: number | ((prev: number) => number)) => void;
  setRunPlayerHealth: (action: number | ((prev: number) => number)) => void;
  setRunMaxHealth: (action: number | ((prev: number) => number)) => void;
  setRoomsEncountered: (action: number | ((prev: number) => number)) => void;
  setCurrentAct: (action: number | ((prev: number) => number)) => void;
  setDestinationIndexInAct: (action: number | ((prev: number) => number)) => void;
  setCompletedDestinations: (
    action:
      | ActiveRunProgressFields["completedDestinations"]
      | ((prev: ActiveRunProgressFields["completedDestinations"]) => ActiveRunProgressFields["completedDestinations"]),
  ) => void;
  setLastOfferedDestinations: (
    action:
      | ActiveRunProgressFields["lastOfferedDestinations"]
      | ((
          prev: ActiveRunProgressFields["lastOfferedDestinations"],
        ) => ActiveRunProgressFields["lastOfferedDestinations"]),
  ) => void;
  setDestinationRoundsSinceOffered: (
    action:
      | ActiveRunProgressFields["destinationRoundsSinceOffered"]
      | ((
          prev: ActiveRunProgressFields["destinationRoundsSinceOffered"],
        ) => ActiveRunProgressFields["destinationRoundsSinceOffered"]),
  ) => void;
  setDestinationOfferState: (state: {
    lastOfferedDestinations: ActiveRunProgressFields["lastOfferedDestinations"];
    roundsSinceOffered: ActiveRunProgressFields["destinationRoundsSinceOffered"];
  }) => void;
  setRunTrinkets: (action: string[] | ((prev: string[]) => string[])) => void;
  setEncounteredRunEnemyIds: (action: string[] | ((prev: string[]) => string[])) => void;
  setSelectedDifficulty: (
    action:
      | ActiveRunProgressFields["selectedDifficulty"]
      | ((prev: ActiveRunProgressFields["selectedDifficulty"]) => ActiveRunProgressFields["selectedDifficulty"]),
  ) => void;
  setContentSystemType: (
    action:
      | ActiveRunProgressFields["contentSystemType"]
      | ((prev: ActiveRunProgressFields["contentSystemType"]) => ActiveRunProgressFields["contentSystemType"]),
  ) => void;
  setCharacter: (selectedId: CharacterId) => void;
  resetProgress: () => void;
  addRunGold: (amount: number) => void;
  nextRunRandom: (stream: RunRngStream) => number;
  resetRunXP: () => void;
  awardCardXP: (card: BattleCard) => void;
  awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
  addRunMaterialsEarned: (materials: MaterialInventory) => void;
  clearRunMaterialsEarned: () => void;
  initialize: (activeRun: ActiveRunData | null, fallbackCharacterId?: CharacterId) => void;
  hydrateFromSnapshot: (snapshot: RunStartSnapshot) => void;
}
