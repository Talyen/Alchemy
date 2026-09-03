import type { BattleState, EndPlayerTurnResolution } from "@/lib/battle";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import type { BattleCard } from "@/lib/game-data";
import type { CharacterId, KeywordId } from "@/lib/game-data";
import { addTalentXP, filterKeywordsForTalentXP, getCardKeywords } from "@/lib/game-data";
import type { RunRngStream } from "@/lib/rng";
import { nextRunRngValue } from "@/lib/rng";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import { current, isDraft, type Draft } from "immer";
import type { GameplayDraft } from "./run-session-command";
import { getGoldMultiplier } from "@/lib/game-data";
import { createInitialActiveRunFields, runFieldsFromSnapshot, type ActiveRunProgressFields } from "./run-state-init";
import { createInitialBattleFields, type DisplayOverrides, type RunDomainBattleState } from "./run-domain-types";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import type { ActiveRunData, RunObtainedItem } from "@/lib/active-run-session";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { Screen } from "@/lib/routing";

function setDraftField<T extends object, K extends keyof T>(
  draft: T,
  field: K,
  action: T[K] | ((prev: T[K]) => T[K]),
): void {
  draft[field] = typeof action === "function" ? (action as (prev: T[K]) => T[K])(draft[field]) : action;
}

export function createDraftFieldSetter<T extends object, Draft>(
  getTarget: (draft: Draft) => T,
): <K extends keyof T>(field: K) => (draft: Draft, action: T[K] | ((prev: T[K]) => T[K])) => void {
  return (field) => (draft, action) => setDraftField(getTarget(draft), field, action);
}

const createRunFieldSetter = createDraftFieldSetter<ActiveRunProgressFields, GameplayDraft>(
  (draft) => draft.run.activeRun,
);

export const setRunDeck = createRunFieldSetter("runDeck");

export function readDraftGold(draft: GameplayDraft): number {
  return draft.runProfile.gold;
}

export function syncBattleGoldFromPurse(draft: GameplayDraft): void {
  if (!draft.battle.hasActiveBattle) return;
  draft.battle.battleState.gold = draft.runProfile.gold;
}

export function syncPurseFromBattleGold(draft: GameplayDraft): void {
  if (!draft.battle.hasActiveBattle) return;
  draft.runProfile.gold = Math.max(0, draft.battle.battleState.gold);
}

export function setGold(draft: GameplayDraft, action: number | ((prev: number) => number)): void {
  const next = typeof action === "function" ? action(draft.runProfile.gold) : action;
  draft.runProfile.gold = Math.max(0, next);
  syncBattleGoldFromPurse(draft);
}

export function addGold(draft: GameplayDraft, amount: number): void {
  const mult = getGoldMultiplier(draft.run.activeRun.characterId, draft.run.activeRun.selectedDifficulty);
  setGold(draft, (gold) => gold + Math.round(amount * mult));
}

export function grantStartGold(draft: GameplayDraft, amount: number): void {
  if (amount <= 0) return;
  setGold(draft, (gold) => gold + amount);
}

export function deductGold(draft: GameplayDraft, amount: number): void {
  if (amount <= 0) return;
  setGold(draft, (gold) => Math.max(0, gold - amount));
}

export const setRunPlayerHealth = createRunFieldSetter("runPlayerHealth");
export const setRunMaxHealth = createRunFieldSetter("runMaxHealth");
export const setRoomsEncountered = createRunFieldSetter("roomsEncountered");
export const setCurrentAct = createRunFieldSetter("currentAct");
export const setDestinationIndexInAct = createRunFieldSetter("destinationIndexInAct");
export const setCompletedDestinations = createRunFieldSetter("completedDestinations");
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
export const setRunBoons = createRunFieldSetter("runBoons");
export const setEncounteredRunEnemyIds = createRunFieldSetter("encounteredRunEnemyIds");
export const setContentSystemType = createRunFieldSetter("contentSystemType");

export function resetProgress(draft: GameplayDraft): void {
  draft.run.activeRun = {
    ...createInitialActiveRunFields(null, draft.run.activeRun.characterId),
    runTalentXP: {},
  };
  draft.run.initialized = false;
}

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

export function cloneRunObtainedItem(item: RunObtainedItem): RunObtainedItem {
  if (item.kind === "trinket") return { kind: "trinket", trinketId: item.trinketId };
  return {
    kind: "gear",
    instance: { ...item.instance, affixes: item.instance.affixes.map((affix) => ({ ...affix })) },
  };
}

export function recordRunObtainedItem(draft: GameplayDraft, item: RunObtainedItem): void {
  draft.run.activeRun.runObtainedItems = [...draft.run.activeRun.runObtainedItems, cloneRunObtainedItem(item)];
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

export function hydrateFromSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  Object.assign(draft.run.activeRun, runFieldsFromSnapshot(snapshot), {
    runTalentXP: {},
    runMaterialsEarned: emptyInventory(),
    runObtainedItems: [],
  });
}

export function setScreen(draft: GameplayDraft, action: Screen | ((prev: Screen) => Screen)): void {
  draft.run.navigation.screen = typeof action === "function" ? action(draft.run.navigation.screen) : action;
}

export function resetNavigation(draft: GameplayDraft): void {
  draft.run.navigation.screen = "menu";
}

export function createDraftRunRandomSource(draft: GameplayDraft, stream: RunRngStream): () => number {
  return () => nextRunRandom(draft, stream);
}

export function withDraftWorldBattleRng(draft: GameplayDraft, battleState: BattleState): BattleState {
  const snapshot = isDraft(battleState) ? current(battleState) : battleState;
  return { ...snapshot, rng: createDraftRunRandomSource(draft, "world") };
}

function hydrateBattleState(battleState: BattleState): BattleState {
  return {
    ...battleState,
    deck: battleState.deck.map(hydrateCard),
    hand: battleState.hand.map(hydrateCard),
    discard: battleState.discard.map(hydrateCard),
    exhausted: battleState.exhausted.map(hydrateCard),
    wishOptions: battleState.wishOptions ? battleState.wishOptions.map(hydrateCard) : null,
    wishQueue: battleState.wishQueue ? battleState.wishQueue.map((list) => list.map(hydrateCard)) : [],
  };
}

function hydrateBattleTransition(transition: PersistedBattleTransition | null): PersistedBattleTransition | null {
  if (!transition || !("resultState" in transition)) return transition;
  return {
    ...transition,
    resultState: hydrateBattleState(transition.resultState),
  };
}

function restingWorldRng(): () => number {
  return () => {
    throw new Error("Battle world RNG must be drawn inside dispatchRunSessionCommand via withDraftWorldBattleRng");
  };
}

function rebindBattleWorldRng(battleState: BattleState): BattleState {
  return { ...battleState, rng: restingWorldRng() };
}

export function withRestingWorldBattleRng(battleState: BattleState): BattleState {
  return rebindBattleWorldRng(battleState);
}

export function withRestingEndPlayerTurnResolution(result: EndPlayerTurnResolution): EndPlayerTurnResolution {
  const state = withRestingWorldBattleRng(result.state);
  const afterAttack = result.afterAttackState
    ? { afterAttackState: withRestingWorldBattleRng(result.afterAttackState) }
    : {};
  if (result.kind === "haste") {
    return { ...result, state, ...afterAttack };
  }
  return {
    ...result,
    state,
    enemyTurnStartState: withRestingWorldBattleRng(result.enemyTurnStartState),
    ...afterAttack,
  };
}

export function setSyncedBattleState(
  draft: GameplayDraft,
  action: BattleState | ((prev: BattleState) => BattleState),
): void {
  const prev = draft.battle.battleState;
  draft.battle.battleState = typeof action === "function" ? action(prev) : action;
  draft.battle.displayOverrides = {};
}

export function setBattleState(draft: GameplayDraft, action: BattleState | ((prev: BattleState) => BattleState)): void {
  setSyncedBattleState(draft, (prev) => rebindBattleWorldRng(typeof action === "function" ? action(prev) : action));
  syncPurseFromBattleGold(draft);
}

function setPendingBattleTransition(draft: GameplayDraft, transition: PersistedBattleTransition | null): void {
  draft.battle.pendingBattleTransition = transition;
}

export function clearPendingTransitionResumeRequired(draft: GameplayDraft): void {
  draft.battle.pendingTransitionResumeRequired = false;
}

export function setDisplayOverrides(draft: GameplayDraft, overrides: DisplayOverrides): void {
  draft.battle.displayOverrides = overrides;
}

export function setBattleStartState(draft: GameplayDraft, state: BattleState | null): void {
  draft.battle.battleStartState = state;
}

export function setHasActiveBattle(draft: GameplayDraft, active: boolean | ((prev: boolean) => boolean)): void {
  draft.battle.hasActiveBattle = typeof active === "function" ? active(draft.battle.hasActiveBattle) : active;
}

function rebindPendingTransitionWorldRng(
  pendingBattleTransition: PersistedBattleTransition | null,
): PersistedBattleTransition | null {
  if (!pendingBattleTransition || !("resultState" in pendingBattleTransition)) return pendingBattleTransition;
  return {
    ...pendingBattleTransition,
    resultState: rebindBattleWorldRng(pendingBattleTransition.resultState),
  };
}

export function initializeActiveBattle(
  draft: GameplayDraft,
  battleState: BattleState | null,
  pendingBattleTransition?: PersistedBattleTransition | null,
): void {
  if (!battleState) {
    Object.assign(draft.battle, createInitialBattleFields());
    return;
  }
  const hydratedRaw = hydrateBattleState(battleState);
  const hydrated = rebindBattleWorldRng({ ...hydratedRaw, gold: draft.runProfile.gold });
  const pending = rebindPendingTransitionWorldRng(hydrateBattleTransition(pendingBattleTransition ?? null));
  const battle: Draft<RunDomainBattleState> = draft.battle;
  battle.battleState = hydrated;
  battle.pendingBattleTransition = pending;
  battle.pendingTransitionResumeRequired = pending != null;
  battle.displayOverrides = {};
  battle.battleStartState = hydrated;
  battle.hasActiveBattle = true;
}

export function commitBattleTransition(
  draft: GameplayDraft,
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition | null,
): void {
  setSyncedBattleState(draft, rebindBattleWorldRng(battleState));
  setPendingBattleTransition(draft, rebindPendingTransitionWorldRng(pendingBattleTransition));
  clearPendingTransitionResumeRequired(draft);
  syncPurseFromBattleGold(draft);
}

export function beginBattleTransition(
  draft: GameplayDraft,
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition,
  displayOverrides: DisplayOverrides,
): void {
  setSyncedBattleState(draft, rebindBattleWorldRng(battleState));
  setPendingBattleTransition(draft, rebindPendingTransitionWorldRng(pendingBattleTransition));
  setDisplayOverrides(draft, displayOverrides);
  syncPurseFromBattleGold(draft);
}

export function clearBattleTransition(draft: GameplayDraft): void {
  setPendingBattleTransition(draft, null);
  clearPendingTransitionResumeRequired(draft);
}
