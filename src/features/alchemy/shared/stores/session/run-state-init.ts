import type { ActiveRunData } from "@/lib/active-run-session";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import type { TalentXP } from "@/lib/game-data";
import { getStartingDeck, type CharacterId, type CompanionId, type UnlockedTalents } from "@/lib/game-data";
import { EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear";
import { companionTierItems } from "@/lib/homestead/companions";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import { emptyInventory } from "@/lib/homestead/inventory";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import type { BuildingId, FarmId, HomesteadEffectManifest, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import { createRunRngState } from "@/lib/rng";
import { filterValidDestinationRounds, filterValidDestinations, type Destination } from "@/lib/routing";
import type { PersistedRunProgress } from "@/lib/active-run-session";
export type ActiveRunProgressFields = Omit<
  PersistedRunProgress,
  "completedDestinations" | "lastOfferedDestinations" | "destinationRoundsSinceOffered"
> & {
  completedDestinations: Destination[];
  lastOfferedDestinations: Destination[];
  destinationRoundsSinceOffered: Partial<Record<Destination, number>>;
};

export interface PermanentProgressFields {
  gold: number;
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  materialInventory: MaterialInventory;
  starterHomesteadGrantResolved: boolean;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
  effects: HomesteadEffectManifest;
}

export type ActiveRunReadView = ActiveRunProgressFields & { initialized: boolean };

export { ACTIVE_RUN_PROGRESS_KEYS } from "@/lib/active-run-session";

export function pickActiveRunView(run: {
  activeRun: ActiveRunProgressFields;
  initialized: boolean;
}): ActiveRunReadView {
  return { ...run.activeRun, initialized: run.initialized };
}

// Explicit seed seam for new runs: crypto-random per run (persisted in
// `rng` from here on, so every later draw is reproducible), injectable in
// tests via `runtimeInputs.generateRunSeed` or the `generateSeed` parameter.
// Gameplay never draws Math.random directly.
let fallbackRunSeedCounter = 0;

export function generateRandomRunSeed(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint32Array(1))[0] as number;
  }
  // Last resort for runtimes without WebCrypto: time + process counter.
  fallbackRunSeedCounter += 1;
  return (Date.now() + Math.imul(fallbackRunSeedCounter, 0x9e37_79b9)) >>> 0;
}

function createFreshActiveRunFields(
  characterId: CharacterId,
  generateSeed: () => number = generateRandomRunSeed,
): ActiveRunProgressFields {
  return {
    characterId,
    runDeck: getStartingDeck(characterId),
    runPlayerHealth: MAX_PLAYER_HEALTH,
    runMaxHealth: MAX_PLAYER_HEALTH,
    runMetaMaxHealth: MAX_PLAYER_HEALTH,
    roomsEncountered: 0,
    runHistoryPartial: false,
    runGoldEarned: 0,
    currentAct: 1,
    destinationIndexInAct: 0,
    completedDestinations: [],
    lastOfferedDestinations: [],
    destinationRoundsSinceOffered: {},
    runBoons: [],
    encounteredRunEnemyIds: [],
    runTalentXP: {},
    runMaterialsEarned: emptyInventory(),
    runCurrenciesEarned: { ...EMPTY_CRAFTING_CURRENCIES },
    runObtainedItems: [],
    runHistory: [],
    selectedDifficulty: null,
    contentSystemType: "campaign",
    rng: createRunRngState(generateSeed()),
  };
}

function createResumeActiveRunFields(activeRun: ActiveRunData, generateSeed: () => number): ActiveRunProgressFields {
  // Detach every nested collection: the committed aggregate is frozen on
  // publish, so retaining a caller-owned branch would freeze the caller's
  // save (including nested battle and visit data).
  return {
    runHistory: (activeRun.runHistory ?? []).map((room) => ({ ...room })),
    runHistoryPartial: activeRun.runHistoryPartial ?? true,
    runGoldEarned: activeRun.runGoldEarned ?? null,
    characterId: activeRun.characterId,
    runDeck: [...activeRun.runDeck],
    runPlayerHealth: activeRun.runPlayerHealth,
    runMaxHealth: activeRun.runMaxHealth,

    runMetaMaxHealth: activeRun.runMetaMaxHealth,
    roomsEncountered: activeRun.roomsEncountered,
    currentAct: activeRun.currentAct,
    destinationIndexInAct: activeRun.destinationIndexInAct,
    completedDestinations: filterValidDestinations(activeRun.completedDestinations),
    lastOfferedDestinations: filterValidDestinations(activeRun.lastOfferedDestinations),
    destinationRoundsSinceOffered: filterValidDestinationRounds(activeRun.destinationRoundsSinceOffered),
    runBoons: [...activeRun.runBoons],
    encounteredRunEnemyIds: [...activeRun.encounteredRunEnemyIds],
    selectedDifficulty: activeRun.selectedDifficulty,
    contentSystemType: activeRun.contentSystemType,
    rng: activeRun.rng
      ? { seed: activeRun.rng.seed, counters: { ...activeRun.rng.counters } }
      : createRunRngState(generateSeed()),
    runTalentXP: { ...(activeRun.runTalentXP ?? {}) },
    runMaterialsEarned: { ...(activeRun.runMaterialsEarned ?? emptyInventory()) },
    runCurrenciesEarned: { ...(activeRun.runCurrenciesEarned ?? EMPTY_CRAFTING_CURRENCIES) },
    runObtainedItems: [...(activeRun.runObtainedItems ?? [])],
  };
}

export function createInitialActiveRunFields(
  initialActiveRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
  generateSeed: () => number = generateRandomRunSeed,
): ActiveRunProgressFields {
  if (!initialActiveRun) return createFreshActiveRunFields(fallbackCharacterId, generateSeed);
  return createResumeActiveRunFields(initialActiveRun, generateSeed);
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
    starterHomesteadGrantResolved: false,
    constructedBuildings,
    plantedFarms,
    completedResearch,
    bondedCompanions,
    effects: computeHomesteadEffects(constructedBuildings, plantedFarms, completedResearch, bondedCompanions),
  };
}
