// Run store initial state and hydration from active-run saves or fresh-run snapshots.
import { getStartingDeck, hydrateCard, type BattleCard, type CharacterId, type UnlockedTalents } from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { DESTINATIONS, type Destination } from "@/features/alchemy/shared/types";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { RunStartSnapshot } from "./run-start";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { DifficultyId, TalentXP } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";

export type RunStateFields = {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  runBoons: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
  talentXP: TalentXP;
  runTalentXP: TalentXP;
  runMaterialsEarned: MaterialInventory;
  unlockedTalents: UnlockedTalents;
  initialized: boolean;
  discoveredCardIdsAtRunStart: string[];
  discoveredBoonIdsAtRunStart: string[];
};

const VALID_DESTINATIONS = new Set<Destination>(Object.values(DESTINATIONS));

export function createInitialRunState(
  initialActiveRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
): RunStateFields {
  const characterId = initialActiveRun?.characterId ?? fallbackCharacterId;
  return {
    characterId,
    runDeck: initialActiveRun
      ? initialActiveRun.runDeck.map(hydrateCard)
      : getStartingDeck(characterId).map((c) => ({ ...c })),
    runGold: initialActiveRun?.runGold ?? 0,
    runPlayerHealth: initialActiveRun?.runPlayerHealth ?? MAX_PLAYER_HEALTH,
    runMaxHealth: initialActiveRun?.runMaxHealth ?? MAX_PLAYER_HEALTH,
    roomsEncountered: initialActiveRun?.roomsEncountered ?? 0,
    currentAct: initialActiveRun?.currentAct ?? 1,
    destinationIndexInAct: initialActiveRun?.destinationIndexInAct ?? 0,
    completedDestinations: initialActiveRun?.completedDestinations?.length
      ? initialActiveRun.completedDestinations.filter((d): d is Destination => VALID_DESTINATIONS.has(d as Destination))
      : [],
    runBoons: initialActiveRun?.runBoons ? [...initialActiveRun.runBoons] : [],
    encounteredRunEnemyIds: initialActiveRun?.encounteredRunEnemyIds
      ? [...initialActiveRun.encounteredRunEnemyIds]
      : [],
    selectedDifficulty: initialActiveRun?.selectedDifficulty ?? null,
    contentSystemType: initialActiveRun?.contentSystemType ?? "campaign",
    talentXP: {},
    runTalentXP: initialActiveRun?.runTalentXP ?? {},
    runMaterialsEarned: initialActiveRun?.runMaterialsEarned ?? emptyInventory(),
    unlockedTalents: {},
    initialized: false,
    discoveredCardIdsAtRunStart: initialActiveRun?.discoveredCardIdsAtRunStart
      ? [...initialActiveRun.discoveredCardIdsAtRunStart]
      : [],
    discoveredBoonIdsAtRunStart: initialActiveRun?.discoveredBoonIdsAtRunStart
      ? [...initialActiveRun.discoveredBoonIdsAtRunStart]
      : [],
  };
}

export function createInitialTalentState(
  initialTalentXP: TalentXP,
  initialUnlockedTalents: UnlockedTalents,
): Pick<RunStateFields, "talentXP" | "unlockedTalents"> {
  return { talentXP: initialTalentXP, unlockedTalents: initialUnlockedTalents };
}

export function runFieldsFromSnapshot(
  snapshot: RunStartSnapshot,
): Pick<
  RunStateFields,
  | "characterId"
  | "contentSystemType"
  | "runDeck"
  | "selectedDifficulty"
  | "runGold"
  | "runPlayerHealth"
  | "runMaxHealth"
  | "roomsEncountered"
  | "currentAct"
  | "destinationIndexInAct"
  | "completedDestinations"
  | "runBoons"
  | "encounteredRunEnemyIds"
  | "discoveredCardIdsAtRunStart"
  | "discoveredBoonIdsAtRunStart"
> {
  return {
    characterId: snapshot.characterId,
    contentSystemType: snapshot.contentSystemType,
    runDeck: snapshot.freshDeck,
    selectedDifficulty: snapshot.selectedDifficulty,
    runGold: snapshot.runGold,
    runPlayerHealth: snapshot.runPlayerHealth,
    runMaxHealth: snapshot.runMaxHealth,
    roomsEncountered: snapshot.roomsEncountered,
    currentAct: snapshot.currentAct,
    destinationIndexInAct: snapshot.destinationIndexInAct,
    completedDestinations: snapshot.completedDestinations,
    runBoons: snapshot.runBoons,
    encounteredRunEnemyIds: [],
    discoveredCardIdsAtRunStart: [],
    discoveredBoonIdsAtRunStart: [],
  };
}
