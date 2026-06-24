// Run store initial state and hydration from active-run saves or fresh-run snapshots.
import {
  getStartingDeck,
  hydrateCard,
  type BattleCard,
  type CharacterId,
  type UnlockedTalents,
  type CompanionId,
} from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { DESTINATIONS, type Destination } from "@/features/alchemy/shared/types";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { RunStartSnapshot } from "./run-start";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { DifficultyId, TalentXP } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import type { MaterialInventory, BuildingId, FarmId, ResearchId, HomesteadEffectManifest } from "@/lib/homestead/types";

export interface RunStateFields {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  lastOfferedDestinations: Destination[];
  destinationRoundsSinceOffered: Partial<Record<Destination, number>>;
  runTrinkets: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
  talentXP: TalentXP;
  runTalentXP: TalentXP;
  runMaterialsEarned: MaterialInventory;
  unlockedTalents: UnlockedTalents;
  materialInventory: MaterialInventory;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
  effects: HomesteadEffectManifest;
  initialized: boolean;
}

const VALID_DESTINATIONS = new Set<Destination>(Object.values(DESTINATIONS));

function filterValidDestinations(values: string[] | undefined): Destination[] {
  if (!values?.length) return [];
  return values.filter((destination): destination is Destination => VALID_DESTINATIONS.has(destination as Destination));
}

function hydrateDestinationRoundsSinceOffered(
  values: Record<string, number> | undefined,
): Partial<Record<Destination, number>> {
  if (!values) return {};
  const roundsSinceOffered: Partial<Record<Destination, number>> = {};
  for (const [destination, rounds] of Object.entries(values)) {
    if (VALID_DESTINATIONS.has(destination as Destination) && typeof rounds === "number" && rounds >= 0) {
      roundsSinceOffered[destination as Destination] = rounds;
    }
  }
  return roundsSinceOffered;
}

function hydrateDeck(initialActiveRun: ActiveRunData | null, characterId: CharacterId): BattleCard[] {
  if (initialActiveRun) return initialActiveRun.runDeck.map(hydrateCard);
  return getStartingDeck(characterId).map((c) => ({ ...c }));
}

function hydrateDestinations(initialActiveRun: ActiveRunData | null): {
  completedDestinations: Destination[];
  lastOfferedDestinations: Destination[];
  destinationRoundsSinceOffered: Partial<Record<Destination, number>>;
} {
  if (!initialActiveRun)
    return { completedDestinations: [], lastOfferedDestinations: [], destinationRoundsSinceOffered: {} };
  return {
    completedDestinations: initialActiveRun.completedDestinations?.length
      ? filterValidDestinations(initialActiveRun.completedDestinations)
      : [],
    lastOfferedDestinations: filterValidDestinations(initialActiveRun.lastOfferedDestinations),
    destinationRoundsSinceOffered: hydrateDestinationRoundsSinceOffered(initialActiveRun.destinationRoundsSinceOffered),
  };
}

function hydrateRunMeta(
  initialActiveRun: ActiveRunData | null,
): Pick<
  RunStateFields,
  | "runGold"
  | "runPlayerHealth"
  | "runMaxHealth"
  | "roomsEncountered"
  | "currentAct"
  | "destinationIndexInAct"
  | "runTrinkets"
  | "encounteredRunEnemyIds"
  | "selectedDifficulty"
  | "contentSystemType"
> {
  const fallback = <T>(val: T | null | undefined, def: T): T => val ?? def;
  const copyIf = <T>(val: T[] | null | undefined): T[] => (val ? [...val] : []);

  const runGold = fallback(initialActiveRun?.runGold, 0);
  const runPlayerHealth = fallback(initialActiveRun?.runPlayerHealth, MAX_PLAYER_HEALTH);
  const runMaxHealth = fallback(initialActiveRun?.runMaxHealth, MAX_PLAYER_HEALTH);
  const roomsEncountered = fallback(initialActiveRun?.roomsEncountered, 0);
  const currentAct = fallback(initialActiveRun?.currentAct, 1);
  const destinationIndexInAct = fallback(initialActiveRun?.destinationIndexInAct, 0);
  const runTrinkets = copyIf(initialActiveRun?.runTrinkets);
  const encounteredRunEnemyIds = copyIf(initialActiveRun?.encounteredRunEnemyIds);
  const selectedDifficulty = fallback(initialActiveRun?.selectedDifficulty, null);
  const contentSystemType = fallback(initialActiveRun?.contentSystemType, "campaign");

  return {
    runGold,
    runPlayerHealth,
    runMaxHealth,
    roomsEncountered,
    currentAct,
    destinationIndexInAct,
    runTrinkets,
    encounteredRunEnemyIds,
    selectedDifficulty,
    contentSystemType,
  };
}

export function createInitialRunState(
  initialActiveRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
): RunStateFields {
  const characterId = initialActiveRun?.characterId ?? fallbackCharacterId;
  const dest = hydrateDestinations(initialActiveRun);
  return {
    characterId,
    runDeck: hydrateDeck(initialActiveRun, characterId),
    ...hydrateRunMeta(initialActiveRun),
    ...dest,
    talentXP: {},
    runTalentXP: initialActiveRun?.runTalentXP ?? {},
    runMaterialsEarned: initialActiveRun?.runMaterialsEarned ?? emptyInventory(),
    unlockedTalents: {},
    materialInventory: emptyInventory(),
    constructedBuildings: createEmptyTierRecord(buildings),
    plantedFarms: createEmptyTierRecord(farmPlots),
    completedResearch: createEmptyTierRecord(researchUpgrades),
    bondedCompanions: createEmptyTierRecord(companionTierItems),
    effects: computeHomesteadEffects(
      createEmptyTierRecord(buildings),
      createEmptyTierRecord(farmPlots),
      createEmptyTierRecord(researchUpgrades),
    ),
    initialized: false,
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
  | "lastOfferedDestinations"
  | "destinationRoundsSinceOffered"
  | "runTrinkets"
  | "encounteredRunEnemyIds"
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
    lastOfferedDestinations: [],
    destinationRoundsSinceOffered: {},
    runTrinkets: snapshot.runTrinkets,
    encounteredRunEnemyIds: [],
  };
}
