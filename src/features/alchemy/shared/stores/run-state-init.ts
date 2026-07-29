// Run store initial state and hydration from active-run saves or fresh-run snapshots.
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import {
  getStartingDeck,
  type BattleCard,
  type CharacterId,
  type UnlockedTalents,
  type CompanionId,
} from "@/lib/game-data";
import { MAX_PLAYER_HEALTH } from "@/lib/game-constants";
import { DESTINATIONS, type Destination } from "@/features/alchemy/shared/types";
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

/** Active-run lifetime fields (deck, gold, HP, acts, run tallies). */
export interface ActiveRunProgressFields {
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
  rng: RunRngState;
  runTalentXP: TalentXP;
  runMaterialsEarned: MaterialInventory;
}

/** Permanent meta lifetime fields (homestead, talents, derived effects). */
export interface PermanentProgressFields {
  talentXP: TalentXP;
  unlockedTalents: UnlockedTalents;
  materialInventory: MaterialInventory;
  constructedBuildings: Record<BuildingId, number>;
  plantedFarms: Record<FarmId, number>;
  completedResearch: Record<ResearchId, number>;
  bondedCompanions: Record<CompanionId, number>;
  effects: HomesteadEffectManifest;
}

/** Flat facade / view projection of progress (run + permanent + initialized). */
export type RunStateFields = ActiveRunProgressFields & PermanentProgressFields & { initialized: boolean };

const ACTIVE_RUN_PROGRESS_KEYS = [
  "characterId",
  "runDeck",
  "runGold",
  "runPlayerHealth",
  "runMaxHealth",
  "roomsEncountered",
  "currentAct",
  "destinationIndexInAct",
  "completedDestinations",
  "lastOfferedDestinations",
  "destinationRoundsSinceOffered",
  "runTrinkets",
  "encounteredRunEnemyIds",
  "selectedDifficulty",
  "contentSystemType",
  "rng",
  "runTalentXP",
  "runMaterialsEarned",
] as const satisfies ReadonlyArray<keyof ActiveRunProgressFields>;

/** Active-run fields shared by `selectRunController` and `pickRunSessionRunSlice` (sans rng / run XP / materials). */
const ACTIVE_RUN_SESSION_CORE_KEYS = [
  "characterId",
  "runDeck",
  "runGold",
  "runPlayerHealth",
  "runMaxHealth",
  "roomsEncountered",
  "currentAct",
  "destinationIndexInAct",
  "completedDestinations",
  "lastOfferedDestinations",
  "destinationRoundsSinceOffered",
  "runTrinkets",
  "encounteredRunEnemyIds",
  "selectedDifficulty",
  "contentSystemType",
] as const satisfies ReadonlyArray<(typeof ACTIVE_RUN_PROGRESS_KEYS)[number]>;

export type ActiveRunSessionCoreFields = Pick<ActiveRunProgressFields, (typeof ACTIVE_RUN_SESSION_CORE_KEYS)[number]>;

/** Shared picker for the active-run core block used by controller + session read models. */
export function pickActiveRunSessionCoreFields(activeRun: ActiveRunProgressFields): ActiveRunSessionCoreFields {
  return {
    characterId: activeRun.characterId,
    runDeck: activeRun.runDeck,
    runGold: activeRun.runGold,
    runPlayerHealth: activeRun.runPlayerHealth,
    runMaxHealth: activeRun.runMaxHealth,
    roomsEncountered: activeRun.roomsEncountered,
    currentAct: activeRun.currentAct,
    destinationIndexInAct: activeRun.destinationIndexInAct,
    completedDestinations: activeRun.completedDestinations,
    lastOfferedDestinations: activeRun.lastOfferedDestinations,
    destinationRoundsSinceOffered: activeRun.destinationRoundsSinceOffered,
    runTrinkets: activeRun.runTrinkets,
    encounteredRunEnemyIds: activeRun.encounteredRunEnemyIds,
    selectedDifficulty: activeRun.selectedDifficulty,
    contentSystemType: activeRun.contentSystemType,
  };
}

const PERMANENT_PROGRESS_KEYS = [
  "talentXP",
  "unlockedTalents",
  "materialInventory",
  "constructedBuildings",
  "plantedFarms",
  "completedResearch",
  "bondedCompanions",
  "effects",
] as const satisfies ReadonlyArray<keyof PermanentProgressFields>;

export function flattenRunDomainProgress(
  activeRun: ActiveRunProgressFields,
  profile: PermanentProgressFields,
  initialized: boolean,
): RunStateFields {
  return { ...activeRun, ...profile, initialized };
}

/** Apply the active-run subset of a flat progress partial onto run-domain state. */
export function applyActiveRunProgressPartial(
  state: { activeRun: ActiveRunProgressFields; initialized: boolean },
  partial: Partial<RunStateFields>,
): void {
  for (const key of ACTIVE_RUN_PROGRESS_KEYS) {
    if (key in partial && partial[key] !== undefined) {
      (state.activeRun as unknown as Record<string, unknown>)[key] = partial[key];
    }
  }
  if (partial.initialized !== undefined) {
    state.initialized = partial.initialized;
  }
}

/** Apply the permanent subset of a flat progress partial onto profile state. */
export function applyPermanentProgressPartial(
  profile: PermanentProgressFields,
  partial: Partial<RunStateFields>,
): void {
  for (const key of PERMANENT_PROGRESS_KEYS) {
    if (key in partial && partial[key] !== undefined) {
      (profile as unknown as Record<string, unknown>)[key] = partial[key];
    }
  }
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
  ActiveRunProgressFields,
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
  | "rng"
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
    rng: initialActiveRun?.rng ?? createRunRngState(),
  };
}

export function createInitialActiveRunFields(
  initialActiveRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
): ActiveRunProgressFields {
  const characterId = initialActiveRun?.characterId ?? fallbackCharacterId;
  const dest = hydrateDestinations(initialActiveRun);
  return {
    characterId,
    runDeck: hydrateDeck(initialActiveRun, characterId),
    ...hydrateRunMeta(initialActiveRun),
    ...dest,
    runTalentXP: initialActiveRun?.runTalentXP ?? {},
    runMaterialsEarned: initialActiveRun?.runMaterialsEarned ?? emptyInventory(),
  };
}

export function createInitialPermanentFields(): PermanentProgressFields {
  const constructedBuildings = createEmptyTierRecord(buildings);
  const plantedFarms = createEmptyTierRecord(farmPlots);
  const completedResearch = createEmptyTierRecord(researchUpgrades);
  return {
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

export function createInitialTalentState(
  initialTalentXP: TalentXP,
  initialUnlockedTalents: UnlockedTalents,
): Pick<PermanentProgressFields, "talentXP" | "unlockedTalents"> {
  return { talentXP: initialTalentXP, unlockedTalents: initialUnlockedTalents };
}

export function runFieldsFromSnapshot(
  snapshot: RunStartSnapshot,
): Pick<
  ActiveRunProgressFields,
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
