import type { BattleCard, CharacterId, DifficultyId, TalentEffectManifest, TalentXP } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Destination } from "@/lib/routing";

/** Shared active-run identity fields used by battle and run-flow orchestration. */
export interface ActiveRunCorePort {
  characterId: CharacterId;
  selectedDifficulty: DifficultyId | null;
  runMaxHealth: number;
  contentSystemType: ContentSystemId;
  roomsEncountered: number;
}

/**
 * Unified orchestration reads for run-flow, content-nav, destinations, and wildwood.
 * Narrow Pick aliases below keep handler deps focused without extra React subscriptions.
 * Gameplay writes stay on draft mutators inside `dispatchRunSessionCommand`.
 */
export interface RunOrchestrationPort extends ActiveRunCorePort {
  currentAct: number;
  runDeck: BattleCard[];
  runPlayerHealth: number;
  gold: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  lastOfferedDestinations: Destination[];
  destinationRoundsSinceOffered: Partial<Record<Destination, number>>;
}

/** Destination availability reads; the resolver stays pure and receives this port. */
export type DestinationRunPort = Pick<
  RunOrchestrationPort,
  "destinationIndexInAct" | "completedDestinations" | "runPlayerHealth" | "gold" | "runMaxHealth"
>;

/** Content-system start/resume reads. */
export type ContentNavigationRunPort = Pick<
  RunOrchestrationPort,
  "contentSystemType" | "lastOfferedDestinations" | "destinationRoundsSinceOffered"
>;

export interface ContentNavigationTalentPort {
  talentXP: TalentXP;
  talentEffects: Pick<TalentEffectManifest, "startGold">;
}

/** Battle initialization and combat reads. */
export interface BattleRunPort extends ActiveRunCorePort {
  runBoons: string[];
  encounteredRunEnemyIds: string[];
  runDeck: BattleCard[];
  gold: number;
}

export interface BattleTalentPort {
  talentEffects: TalentEffectManifest;
}
