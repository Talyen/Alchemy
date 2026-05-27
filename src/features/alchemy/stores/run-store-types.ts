// Run store field and action types (shared by store, selectors, and tests).
import type { BattleCard, CharacterId, DifficultyId, KeywordId, UnlockedTalents } from "@/lib/game-data";
import type { ActiveRunData } from "@/features/alchemy/run/types";
import type { RunStartSnapshot } from "@/features/alchemy/run/run-start";
import type { Destination } from "@/features/alchemy/types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { TalentXP } from "@/lib/talents";
import type { Setter } from "@/lib/utils";
import type { RunStateFields } from "@/features/alchemy/run/run-state-init";

export type RunStoreActions = {
  setRunDeck: Setter<BattleCard[]>;
  setRunGold: Setter<number>;
  setRunPlayerHealth: Setter<number>;
  setRunMaxHealth: Setter<number>;
  setRoomsEncountered: Setter<number>;
  setCurrentAct: Setter<number>;
  setDestinationIndexInAct: Setter<number>;
  setCompletedDestinations: Setter<Destination[]>;
  setRunTrinkets: Setter<string[]>;
  setEncounteredRunEnemyIds: Setter<string[]>;
  setSelectedDifficulty: Setter<DifficultyId | null>;
  setContentSystemType: Setter<ContentSystemId>;
  setCharacter: (selectedId: CharacterId) => void;
  reset: () => void;
  addRunGold: (amount: number) => void;
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  resetRunXP: () => void;
  clearPermanentData: () => void;
  awardCardXP: (card: BattleCard) => void;
  awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
  finalizeRunXP: () => void;
  initialize: (
    activeRun: ActiveRunData | null,
    talentXP: TalentXP,
    unlockedTalents: UnlockedTalents,
    fallbackCharacterId?: CharacterId,
  ) => void;
  hydrateFromSnapshot: (snapshot: RunStartSnapshot) => void;
};

export type RunStore = RunStateFields & RunStoreActions;
