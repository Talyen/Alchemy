// Run store initial state and hydration from active-run saves or fresh-run snapshots.
import {
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type UnlockedTalents,
  type CompanionId,
} from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { type Destination } from "@/lib/routing";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { DifficultyId, TalentXP } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import { createEmptyTierRecord } from "@/lib/homestead/tiers";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { companionTierItems } from "@/lib/homestead/companions";
import { computeHomesteadEffects } from "@/lib/homestead/effects";
import type { MaterialInventory, BuildingId, FarmId, ResearchId, HomesteadEffectManifest } from "@/lib/homestead/types";
import { createRunRngState, type RunRngState } from "@/lib/run-rng";
import { filterValidDestinations, filterValidDestinationRounds } from "@/lib/routing";

/** Active-run lifetime fields (deck, HP, acts, run tallies). */
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
}

/** Permanent meta lifetime fields (homestead, talents, derived effects). */
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

/**
 * Full active-run fields + initialized flag. Derived from the canonical model so
 * adding a field flows into every committed session read and the imperative read.
 */
export type ActiveRunReadView = ActiveRunProgressFields & { initialized: boolean };

/**
 * Canonical picker for the full active-run read view (progress fields + initialized),
 * used by the committed read model, the run read port, and the orchestration port.
 * Progress-fields-only callers (persistence codec, snapshot assembly) use
 * {@link pickActiveRunFields} from this module; there is no second hand-maintained projection.
 */
export function pickActiveRunView(run: {
  activeRun: ActiveRunProgressFields;
  initialized: boolean;
}): ActiveRunReadView {
  return { ...run.activeRun, initialized: run.initialized };
}

/** Progress-fields-only projection used by the resume codec and orchestration reads. */
export function pickActiveRunFields(activeRun: ActiveRunProgressFields): ActiveRunProgressFields {
  return { ...activeRun };
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
    completedDestinations: [],
    lastOfferedDestinations: [],
    destinationRoundsSinceOffered: {},
    runBoons: [],
    encounteredRunEnemyIds: [],
    selectedDifficulty: null,
    contentSystemType: "campaign",
    rng: createRunRngState(),
    runTalentXP: {},
    runMaterialsEarned: emptyInventory(),
  };
}

/** Resume path: ActiveRunData is already Zod-parsed and hydrated at the persistence boundary. */
function createResumeActiveRunFields(activeRun: ActiveRunData): ActiveRunProgressFields {
  return {
    characterId: activeRun.characterId,
    runDeck: [...activeRun.runDeck],
    runPlayerHealth: activeRun.runPlayerHealth,
    runMaxHealth: activeRun.runMaxHealth,
    // Legacy 0 baselines are already shimmed to runMaxHealth by normalizeActiveRunData.
    runMetaMaxHealth: activeRun.runMetaMaxHealth,
    roomsEncountered: activeRun.roomsEncountered,
    currentAct: activeRun.currentAct,
    destinationIndexInAct: activeRun.destinationIndexInAct,
    ...hydrateDestinations(activeRun),
    runBoons: [...activeRun.runBoons],
    encounteredRunEnemyIds: [...activeRun.encounteredRunEnemyIds],
    selectedDifficulty: activeRun.selectedDifficulty,
    contentSystemType: activeRun.contentSystemType,
    rng: activeRun.rng ?? createRunRngState(),
    runTalentXP: activeRun.runTalentXP ?? {},
    runMaterialsEarned: activeRun.runMaterialsEarned ?? emptyInventory(),
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
  return {
    gold: 0,
    talentXP: {},
    unlockedTalents: {},
    materialInventory: emptyInventory(),
    constructedBuildings,
    plantedFarms,
    completedResearch,
    bondedCompanions: createEmptyTierRecord(companionTierItems),
    effects: computeHomesteadEffects(constructedBuildings, plantedFarms, completedResearch),
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
