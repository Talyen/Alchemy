import type { ActiveRunData } from "@/lib/active-run-session";
import type { BattleCard, CharacterId, CompanionId, KeywordId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import type { RunStartSnapshot } from "@/features/alchemy/run-setup/run/run-start";
import type { RunStateFields } from "@/features/alchemy/run-setup/run/run-state-init";

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
      | RunStateFields["completedDestinations"]
      | ((prev: RunStateFields["completedDestinations"]) => RunStateFields["completedDestinations"]),
  ) => void;
  setLastOfferedDestinations: (
    action:
      | RunStateFields["lastOfferedDestinations"]
      | ((prev: RunStateFields["lastOfferedDestinations"]) => RunStateFields["lastOfferedDestinations"]),
  ) => void;
  setDestinationRoundsSinceOffered: (
    action:
      | RunStateFields["destinationRoundsSinceOffered"]
      | ((prev: RunStateFields["destinationRoundsSinceOffered"]) => RunStateFields["destinationRoundsSinceOffered"]),
  ) => void;
  setDestinationOfferState: (state: {
    lastOfferedDestinations: RunStateFields["lastOfferedDestinations"];
    roundsSinceOffered: RunStateFields["destinationRoundsSinceOffered"];
  }) => void;
  setRunTrinkets: (action: string[] | ((prev: string[]) => string[])) => void;
  setEncounteredRunEnemyIds: (action: string[] | ((prev: string[]) => string[])) => void;
  setSelectedDifficulty: (
    action:
      | RunStateFields["selectedDifficulty"]
      | ((prev: RunStateFields["selectedDifficulty"]) => RunStateFields["selectedDifficulty"]),
  ) => void;
  setContentSystemType: (
    action:
      | RunStateFields["contentSystemType"]
      | ((prev: RunStateFields["contentSystemType"]) => RunStateFields["contentSystemType"]),
  ) => void;
  setCharacter: (selectedId: CharacterId) => void;
  resetProgress: () => void;
  addRunGold: (amount: number) => void;
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  resetRunXP: () => void;
  clearPermanentData: () => void;
  awardCardXP: (card: BattleCard) => void;
  awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
  addRunMaterialsEarned: (materials: MaterialInventory) => void;
  clearRunMaterialsEarned: () => void;
  finalizeRunXP: () => void;
  initialize: (
    activeRun: ActiveRunData | null,
    talentXP: TalentXP,
    unlockedTalents: UnlockedTalents,
    fallbackCharacterId?: CharacterId,
  ) => void;
  hydrateFromSnapshot: (snapshot: RunStartSnapshot) => void;
  addMaterials: (materials: MaterialInventory) => void;
  setMaterials: (materials: MaterialInventory) => void;
  constructBuilding: (id: BuildingId) => boolean;
  plantFarm: (id: FarmId) => boolean;
  completeResearch: (id: ResearchId) => boolean;
  bondCompanion: (id: CompanionId) => boolean;
}
