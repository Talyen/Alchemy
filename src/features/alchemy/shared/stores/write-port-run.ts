import type { BattleCard } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle";
import type { CharacterId, KeywordId } from "@/lib/game-data";
import { addTalentXP, filterKeywordsForTalentXP, getCardKeywords } from "@/lib/game-data";
import type { RunRngStream } from "@/lib/run-rng";
import { nextRunRngValue } from "@/lib/run-rng";
import { current, isDraft } from "immer";
import type { GameplayDraft } from "./run-session-command";
import { addProfileGold, setProfileGold } from "./gold-purse";
import { createInitialActiveRunFields, runFieldsFromSnapshot, type ActiveRunProgressFields } from "./run-state-init";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { Screen } from "@/lib/routing";

/** Set an active-run field from a direct value or an updater over the previous value. */
function setRunField<K extends keyof ActiveRunProgressFields>(
  draft: GameplayDraft,
  field: K,
  action: ActiveRunProgressFields[K] | ((prev: ActiveRunProgressFields[K]) => ActiveRunProgressFields[K]),
): void {
  draft.run.activeRun[field] = typeof action === "function" ? action(draft.run.activeRun[field]) : action;
}

export function setRunDeck(draft: GameplayDraft, action: BattleCard[] | ((prev: BattleCard[]) => BattleCard[])): void {
  setRunField(draft, "runDeck", action);
}
export function setRunGold(draft: GameplayDraft, action: number | ((prev: number) => number)): void {
  setProfileGold(draft, action);
}
export function addRunGold(draft: GameplayDraft, amount: number): void {
  addProfileGold(draft, amount);
}
export const setRunPlayerHealth = (draft: GameplayDraft, action: number | ((prev: number) => number)) =>
  setRunField(draft, "runPlayerHealth", action);
export const setRunMaxHealth = (draft: GameplayDraft, action: number | ((prev: number) => number)) =>
  setRunField(draft, "runMaxHealth", action);
export const setRoomsEncountered = (draft: GameplayDraft, action: number | ((prev: number) => number)) =>
  setRunField(draft, "roomsEncountered", action);
export const setCurrentAct = (draft: GameplayDraft, action: number | ((prev: number) => number)) =>
  setRunField(draft, "currentAct", action);
export const setDestinationIndexInAct = (draft: GameplayDraft, action: number | ((prev: number) => number)) =>
  setRunField(draft, "destinationIndexInAct", action);
export const setCompletedDestinations = (
  draft: GameplayDraft,
  action:
    | ActiveRunProgressFields["completedDestinations"]
    | ((prev: ActiveRunProgressFields["completedDestinations"]) => ActiveRunProgressFields["completedDestinations"]),
) => setRunField(draft, "completedDestinations", action);
export function setDestinationOfferState(
  draft: GameplayDraft,
  offerState: {
    lastOfferedDestinations: ActiveRunProgressFields["lastOfferedDestinations"];
    roundsSinceOffered: ActiveRunProgressFields["destinationRoundsSinceOffered"];
  },
): void {
  draft.run.activeRun.lastOfferedDestinations = [...offerState.lastOfferedDestinations];
  draft.run.activeRun.destinationRoundsSinceOffered = { ...offerState.roundsSinceOffered };
}
export const setRunBoons = (draft: GameplayDraft, action: string[] | ((prev: string[]) => string[])) =>
  setRunField(draft, "runBoons", action);
export const setEncounteredRunEnemyIds = (draft: GameplayDraft, action: string[] | ((prev: string[]) => string[])) =>
  setRunField(draft, "encounteredRunEnemyIds", action);
export const setContentSystemType = (
  draft: GameplayDraft,
  action:
    | ActiveRunProgressFields["contentSystemType"]
    | ((prev: ActiveRunProgressFields["contentSystemType"]) => ActiveRunProgressFields["contentSystemType"]),
) => setRunField(draft, "contentSystemType", action);

/** Clear run-scoped tallies while keeping the chosen character. */
export function resetProgress(draft: GameplayDraft): void {
  draft.run.activeRun = {
    ...createInitialActiveRunFields(null, draft.run.activeRun.characterId),
    runTalentXP: {},
  };
  draft.run.initialized = true;
}

/** Draw the next value from a named run RNG stream and persist its counter. */
export function nextRunRandom(draft: GameplayDraft, stream: RunRngStream): number {
  const draw = nextRunRngValue(draft.run.activeRun.rng, stream);
  draft.run.activeRun.rng.counters[stream] = draw.nextCounter;
  return draw.value;
}

export function resetRunXP(draft: GameplayDraft): void {
  draft.run.activeRun.runTalentXP = {};
}

export function awardCardXP(draft: GameplayDraft, card: BattleCard): void {
  const keywords = filterKeywordsForTalentXP(getCardKeywords(card));
  if (keywords.length === 0) return;
  draft.run.activeRun.runTalentXP = addTalentXP(draft.run.activeRun.runTalentXP, keywords);
}

export function awardMysteryXP(draft: GameplayDraft, keywordId: KeywordId, amount: number): void {
  const keywords = filterKeywordsForTalentXP([keywordId]);
  if (keywords.length === 0) return;
  draft.run.activeRun.runTalentXP = addTalentXP(draft.run.activeRun.runTalentXP, keywords, amount);
}

export function addRunMaterialsEarned(draft: GameplayDraft, materials: MaterialInventory): void {
  draft.run.activeRun.runMaterialsEarned = addInventory(draft.run.activeRun.runMaterialsEarned, materials);
}

export function clearRunMaterialsEarned(draft: GameplayDraft): void {
  draft.run.activeRun.runMaterialsEarned = emptyInventory();
}

export function initializeActiveRun(
  draft: GameplayDraft,
  activeRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
): void {
  draft.run.activeRun = createInitialActiveRunFields(activeRun, fallbackCharacterId);
  draft.run.initialized = true;
}

export function initializeFromResumeSnapshot(draft: GameplayDraft, activeRun: ActiveRunProgressFields): void {
  draft.run.activeRun = activeRun;
  draft.run.initialized = true;
}

/** Seed active-run fields from a run start, clearing per-run tallies and destination offers. */
export function hydrateFromSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  Object.assign(draft.run.activeRun, runFieldsFromSnapshot(snapshot), {
    runTalentXP: {},
    runMaterialsEarned: emptyInventory(),
    lastOfferedDestinations: [],
    destinationRoundsSinceOffered: {},
  });
}

// --- Navigation (screen routing lives inside the run domain) ---

export function setScreen(draft: GameplayDraft, action: Screen | ((prev: Screen) => Screen)): void {
  draft.run.navigation.screen = typeof action === "function" ? action(draft.run.navigation.screen) : action;
}

export function resetNavigation(draft: GameplayDraft): void {
  draft.run.navigation.screen = "menu";
}

// --- Battle RNG binding helpers ---

export function createDraftRunRandomSource(draft: GameplayDraft, stream: RunRngStream): () => number {
  return () => nextRunRandom(draft, stream);
}

/** Bind a battle snapshot to the draft `world` stream for one command body. */
export function withDraftWorldBattleRng(draft: GameplayDraft, battleState: BattleState): BattleState {
  const snapshot = isDraft(battleState) ? current(battleState) : battleState;
  return { ...snapshot, rng: createDraftRunRandomSource(draft, "world") };
}
