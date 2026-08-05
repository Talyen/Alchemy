import type { BattleCard, CharacterId, DifficultyId, KeywordId, TalentEffectManifest, TalentXP } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Destination } from "@/features/alchemy/shared/types";

/** Active-run fields and commands used by run-flow orchestration. */
export interface RunFlowRunPort {
  contentSystemType: ContentSystemId;
  currentAct: number;
  selectedDifficulty: DifficultyId | null;
  characterId: CharacterId;
  runMaxHealth: number;
  updateCurrentAct: (value: number | ((prev: number) => number)) => void;
  updateDestinationIndexInAct: (value: number | ((prev: number) => number)) => void;
  updateCompletedDestinations: (value: Destination[] | ((prev: Destination[]) => Destination[])) => void;
  updateRoomsEncountered: (value: number | ((prev: number) => number)) => void;
  updateRunDeck: (value: BattleCard[] | ((prev: BattleCard[]) => BattleCard[])) => void;
  updateRunTrinkets: (value: string[] | ((prev: string[]) => string[])) => void;
  updateRunPlayerHealth: (value: number | ((prev: number) => number)) => void;
}

/** Talent effects used by run-flow handlers (currently campfire healing). */
export interface RunFlowTalentPort {
  talentEffects: Pick<TalentEffectManifest, "campfireHealBonus">;
}

/** Destination availability reads; the resolver stays pure and receives this port. */
export interface DestinationRunPort {
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  runPlayerHealth: number;
  runGold: number;
  runMaxHealth: number;
}

/** Content-system start/resume reads and the destination-offer writer. */
export interface ContentNavigationRunPort {
  contentSystemType: ContentSystemId;
  lastOfferedDestinations: Destination[];
  destinationRoundsSinceOffered: Partial<Record<Destination, number>>;
  updateDestinationOfferState: (offerState: {
    lastOfferedDestinations: Destination[];
    roundsSinceOffered: Partial<Record<Destination, number>>;
  }) => void;
}

export interface ContentNavigationTalentPort {
  talentXP: TalentXP;
  talentEffects: Pick<TalentEffectManifest, "startGold">;
}

export interface TalentCommandPort {
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  resetUnlockedTalents: () => void;
}

/** Wildwood draft and deck fields used by the gauntlet flow. */
export interface WildwoodRunPort {
  contentSystemType: ContentSystemId;
  characterId: CharacterId;
  runDeck: BattleCard[];
  updateRunDeck: (value: BattleCard[] | ((prev: BattleCard[]) => BattleCard[])) => void;
}

/** Corruption flow only needs the run deck reader/writer. */
export interface CorruptionRunPort {
  runDeck: BattleCard[];
  updateRunDeck: (value: BattleCard[] | ((prev: BattleCard[]) => BattleCard[])) => void;
}

/** Battle initialization and combat commands. */
export interface BattleRunPort {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  runMaxHealth: number;
  runTrinkets: string[];
  roomsEncountered: number;
  updateRoomsEncountered: (value: number | ((prev: number) => number)) => void;
  contentSystemType: ContentSystemId;
  encounteredRunEnemyIds: string[];
  updateEncounteredRunEnemyIds: (value: string[] | ((prev: string[]) => string[])) => void;
  runDeck: BattleCard[];
  runGold: number;
}

export interface BattleTalentPort {
  talentEffects: TalentEffectManifest;
  awardCardXP: (card: BattleCard) => void;
}
