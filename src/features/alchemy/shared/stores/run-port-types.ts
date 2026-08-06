import type { BattleCard, CharacterId, DifficultyId, TalentEffectManifest, TalentXP } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Destination } from "@/features/alchemy/shared/types";

/** Shared active-run identity fields used by battle and run-flow orchestration. */
export interface ActiveRunCorePort {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  runMaxHealth: number;
  contentSystemType: ContentSystemId;
  roomsEncountered: number;
  updateRoomsEncountered: (value: number | ((prev: number) => number)) => void;
}

/**
 * Unified orchestration reads/writes for run-flow, content-nav, destinations, and wildwood.
 * Narrow Pick aliases below keep handler deps focused without extra React subscriptions.
 */
export interface RunOrchestrationPort extends ActiveRunCorePort {
  currentAct: number;
  runDeck: BattleCard[];
  runPlayerHealth: number;
  runGold: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  lastOfferedDestinations: Destination[];
  destinationRoundsSinceOffered: Partial<Record<Destination, number>>;
  updateCurrentAct: (value: number | ((prev: number) => number)) => void;
  updateDestinationIndexInAct: (value: number | ((prev: number) => number)) => void;
  updateCompletedDestinations: (value: Destination[] | ((prev: Destination[]) => Destination[])) => void;
  updateRunDeck: (value: BattleCard[] | ((prev: BattleCard[]) => BattleCard[])) => void;
  updateRunTrinkets: (value: string[] | ((prev: string[]) => string[])) => void;
  updateRunPlayerHealth: (value: number | ((prev: number) => number)) => void;
  updateDestinationOfferState: (offerState: {
    lastOfferedDestinations: Destination[];
    roundsSinceOffered: Partial<Record<Destination, number>>;
  }) => void;
}

/** Active-run fields and commands used by run-flow orchestration handlers. */
export type RunFlowRunPort = Pick<
  RunOrchestrationPort,
  | "characterId"
  | "selectedDifficulty"
  | "runMaxHealth"
  | "contentSystemType"
  | "roomsEncountered"
  | "updateRoomsEncountered"
  | "currentAct"
  | "updateCurrentAct"
  | "updateDestinationIndexInAct"
  | "updateCompletedDestinations"
  | "updateRunDeck"
  | "updateRunTrinkets"
  | "updateRunPlayerHealth"
>;

/** Talent effects used by run-flow handlers (currently campfire healing). */
export interface RunFlowTalentPort {
  talentEffects: Pick<TalentEffectManifest, "campfireHealBonus">;
}

/** Destination availability reads; the resolver stays pure and receives this port. */
export type DestinationRunPort = Pick<
  RunOrchestrationPort,
  "destinationIndexInAct" | "completedDestinations" | "runPlayerHealth" | "runGold" | "runMaxHealth"
>;

/** Content-system start/resume reads and the destination-offer writer. */
export type ContentNavigationRunPort = Pick<
  RunOrchestrationPort,
  "contentSystemType" | "lastOfferedDestinations" | "destinationRoundsSinceOffered" | "updateDestinationOfferState"
>;

export interface ContentNavigationTalentPort {
  talentXP: TalentXP;
  talentEffects: Pick<TalentEffectManifest, "startGold">;
}

export type WildwoodRunPort = Pick<
  RunOrchestrationPort,
  "contentSystemType" | "characterId" | "runDeck" | "updateRunDeck"
>;

/** Battle initialization and combat commands. */
export interface BattleRunPort extends ActiveRunCorePort {
  runTrinkets: string[];
  encounteredRunEnemyIds: string[];
  updateEncounteredRunEnemyIds: (value: string[] | ((prev: string[]) => string[])) => void;
  runDeck: BattleCard[];
  runGold: number;
}

export interface BattleTalentPort {
  talentEffects: TalentEffectManifest;
  awardCardXP: (card: BattleCard) => void;
}
