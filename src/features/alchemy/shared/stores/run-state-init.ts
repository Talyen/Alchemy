import {
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type UnlockedTalents,
  type CompanionId,
} from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { type Destination } from "@/lib/routing";
import type { ActiveRunData, RunObtainedItem } from "@/lib/active-run-session";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { DifficultyId, TalentXP } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import type { MaterialInventory, BuildingId, FarmId, ResearchId, HomesteadEffectManifest } from "@/lib/homestead/types";
import { createRunRngState, type RunRngState } from "@/lib/rng";
import { filterValidDestinations, filterValidDestinationRounds } from "@/lib/routing";

export interface ActiveRunProgressFields {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runPlayerHealth: number;
  runMaxHealth: number;
  runMetaMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  lastOfferedDestinations: Destination[];
  destinationRoundsSinceOffered: Partial<Record<Destination, number>>;
  runBoons: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
  rng: RunRngState;
  runTalentXP: TalentXP;
  runMaterialsEarned: MaterialInventory;
  runObtainedItems: RunObtainedItem[];
}

export interface PermanentProgressFields {
  gold: number;
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  materialInventory: MaterialInventory;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
  effects: HomesteadEffectManifest;
}

export type ActiveRunReadView = ActiveRunProgressFields & { initialized: boolean };

export const ACTIVE_RUN_PROGRESS_KEYS = [
  "characterId",
  "runDeck",
  "runPlayerHealth",
  "runMaxHealth",
  "runMetaMaxHealth",
  "roomsEncountered",
  "currentAct",
  "destinationIndexInAct",
  "completedDestinations",
  "lastOfferedDestinations",
  "destinationRoundsSinceOffered",
  "runBoons",
  "encounteredRunEnemyIds",
  "selectedDifficulty",
  "contentSystemType",
  "rng",
  "runTalentXP",
  "runMaterialsEarned",
  "runObtainedItems",
] as const satisfies ReadonlyArray<keyof ActiveRunProgressFields>;

export function pickActiveRunView(run: {
  activeRun: ActiveRunProgressFields;
  initialized: boolean;
}): ActiveRunReadView {
  return { ...run.activeRun, initialized: run.initialized };
}

function hydrateDestinations(initialActiveRun: ActiveRunData): {
  completedDestinations: Destination[];
  lastOfferedDestinations: Destination[];
  destinationRoundsSinceOffered: Partial<Record<Destination, number>>;
} {
  return {
    completedDestinations: filterValidDestinations(initialActiveRun.completedDestinations),
    lastOfferedDestinations: filterValidDestinations(initialActiveRun.lastOfferedDestinations),
    destinationRoundsSinceOffered: filterValidDestinationRounds(initialActiveRun.destinationRoundsSinceOffered),
  };
}

function createEmptyActiveRunCollections(): Pick<
  ActiveRunProgressFields,
  | "completedDestinations"
  | "lastOfferedDestinations"
  | "destinationRoundsSinceOffered"
  | "runBoons"
  | "encounteredRunEnemyIds"
  | "runTalentXP"
  | "runMaterialsEarned"
  | "runObtainedItems"
> {
  return {
    completedDestinations: [],
    lastOfferedDestinations: [],
    destinationRoundsSinceOffered: {},
    runBoons: [],
    encounteredRunEnemyIds: [],
    runTalentXP: {},
    runMaterialsEarned: emptyInventory(),
    runObtainedItems: [],
  };
}

function createFreshRunRngState(): RunRngState {
  return createRunRngState(generateRunSeed());
}

// Explicit seed seam for new runs: crypto-random per run (persisted in
// `rng` from here on, so every later draw is reproducible), injectable in
// tests via the optional override. Gameplay never draws Math.random directly.
let testRunSeedOverride: number | null = null;
let fallbackRunSeedCounter = 0;

export function setTestRunSeedOverride(seed: number | null): void {
  testRunSeedOverride = seed;
}

export function generateRunSeed(): number {
  if (testRunSeedOverride !== null) return testRunSeedOverride >>> 0;
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint32Array(1))[0] as number;
  }
  // Last resort for runtimes without WebCrypto: time + process counter.
  fallbackRunSeedCounter += 1;
  return (Date.now() + Math.imul(fallbackRunSeedCounter, 0x9e37_79b9)) >>> 0;
}

function createFreshActiveRunFields(characterId: CharacterId): ActiveRunProgressFields {
  return {
    characterId,
    runDeck: getStartingDeck(characterId).map((c) => ({ ...c })),
    runPlayerHealth: MAX_PLAYER_HEALTH,
    runMaxHealth: MAX_PLAYER_HEALTH,
    runMetaMaxHealth: MAX_PLAYER_HEALTH,
    roomsEncountered: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    ...createEmptyActiveRunCollections(),
    selectedDifficulty: null,
    contentSystemType: "campaign",
    rng: createFreshRunRngState(),
  };
}

function createResumeActiveRunFields(activeRun: ActiveRunData): ActiveRunProgressFields {
  const empty = createEmptyActiveRunCollections();
  return {
    characterId: activeRun.characterId,
    runDeck: [...activeRun.runDeck],
    runPlayerHealth: activeRun.runPlayerHealth,
    runMaxHealth: activeRun.runMaxHealth,

    runMetaMaxHealth: activeRun.runMetaMaxHealth,
    roomsEncountered: activeRun.roomsEncountered,
    currentAct: activeRun.currentAct,
    destinationIndexInAct: activeRun.destinationIndexInAct,
    ...hydrateDestinations(activeRun),
    runBoons: [...activeRun.runBoons],
    encounteredRunEnemyIds: [...activeRun.encounteredRunEnemyIds],
    selectedDifficulty: activeRun.selectedDifficulty,
    contentSystemType: activeRun.contentSystemType,
    rng: activeRun.rng ?? createFreshRunRngState(),
    runTalentXP: activeRun.runTalentXP ?? empty.runTalentXP,
    runMaterialsEarned: activeRun.runMaterialsEarned ?? empty.runMaterialsEarned,
    runObtainedItems: [...(activeRun.runObtainedItems ?? empty.runObtainedItems)],
  };
}

export function createInitialActiveRunFields(
  initialActiveRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
): ActiveRunProgressFields {
  if (!initialActiveRun) return createFreshActiveRunFields(fallbackCharacterId);
  return createResumeActiveRunFields(initialActiveRun);
}

export function createInitialPermanentFields(): PermanentProgressFields {
  const constructedBuildings = createEmptyTierRecord(buildings);
  const plantedFarms = createEmptyTierRecord(farmPlots);
  const completedResearch = createEmptyTierRecord(researchUpgrades);
  const bondedCompanions = createEmptyTierRecord(companionTierItems);
  return {
    gold: 0,
    talentXP: {},
    unlockedTalents: {},
    materialInventory: emptyInventory(),
    constructedBuildings,
    plantedFarms,
    completedResearch,
    bondedCompanions,
    effects: computeHomesteadEffects(constructedBuildings, plantedFarms, completedResearch, bondedCompanions),
  };
}

export function runFieldsFromSnapshot(
  snapshot: RunStartSnapshot,
): Pick<
  ActiveRunProgressFields,
  | "characterId"
  | "contentSystemType"
  | "runDeck"
  | "selectedDifficulty"
  | "runPlayerHealth"
  | "runMaxHealth"
  | "runMetaMaxHealth"
  | "roomsEncountered"
  | "currentAct"
  | "destinationIndexInAct"
  | "completedDestinations"
  | "lastOfferedDestinations"
  | "destinationRoundsSinceOffered"
  | "runBoons"
  | "encounteredRunEnemyIds"
> {
  return {
    characterId: snapshot.characterId,
    contentSystemType: snapshot.contentSystemType,
    runDeck: snapshot.freshDeck,
    selectedDifficulty: snapshot.selectedDifficulty,
    runPlayerHealth: snapshot.runPlayerHealth,
    runMaxHealth: snapshot.runMaxHealth,
    runMetaMaxHealth: snapshot.runMaxHealth,
    roomsEncountered: snapshot.roomsEncountered,
    currentAct: snapshot.currentAct,
    destinationIndexInAct: snapshot.destinationIndexInAct,
    completedDestinations: snapshot.completedDestinations,
    lastOfferedDestinations: [],
    destinationRoundsSinceOffered: {},
    runBoons: snapshot.runBoons,
    encounteredRunEnemyIds: [],
  };
}
