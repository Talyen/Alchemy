import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { ActiveRunData, PersistedBattleTransition, RunObtainedItem } from "@/lib/active-run-session";
import { transitionRunActivity } from "@/lib/active-run-session";
import { battleSnapshot, type BattleState, type BattleSnapshot } from "@/lib/battle";
import type { BattleCard, CharacterId, KeywordId } from "@/lib/game-data";
import { addTalentXP, filterKeywordsForTalentXP, getCardKeywords, getGoldMultiplier } from "@/lib/game-data";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { stepRunRng, type RunRngStream } from "@/lib/rng";
import { type Screen } from "@/lib/routing";
import { current, isDraft, type Draft } from "immer";
import { createInitialBattleFields, type RunDomainBattleState } from "./run-domain-types";
import type { GameplayDraft } from "./run-session-command";
import { createInitialActiveRunFields, runFieldsFromSnapshot, type ActiveRunProgressFields } from "./run-state-init";

function setDraftField<T extends object, K extends keyof T>(
  draft: T,
  field: K,
  action: T[K] | ((prev: T[K]) => T[K]),
): void {
  draft[field] = typeof action === "function" ? (action as (prev: T[K]) => T[K])(draft[field]) : action;
}

export function createDraftFieldSetter<T extends object, TDraft>(
  getTarget: (draft: TDraft) => T,
): <K extends keyof T>(field: K) => (draft: TDraft, action: T[K] | ((prev: T[K]) => T[K])) => void {
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
  const pending = draft.battle.pendingBattleTransition;
  if (pending && "resultState" in pending) {
    const pendingGoldChange = pending.resultState.gold - draft.battle.battleState.gold;
    pending.resultState.gold = draft.runProfile.gold + pendingGoldChange;
  }
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

export function resetProgress(draft: GameplayDraft): void {
  draft.run.activeRun = {
    ...createInitialActiveRunFields(null, draft.run.activeRun.characterId),
    runTalentXP: {},
  };
  draft.run.initialized = false;
}

export function nextRunRandom(draft: GameplayDraft, stream: RunRngStream): number {
  return stepRunRng(draft.run.activeRun.rng, stream);
}

export function resetRunXP(draft: GameplayDraft): void {
  draft.run.activeRun.runTalentXP = {};
}

export function awardCardXP(draft: GameplayDraft, card: BattleCard): void {
  const keywords = filterKeywordsForTalentXP(getCardKeywords(card));
  if (keywords.length === 0) return;
  draft.run.activeRun.runTalentXP = addTalentXP(draft.run.activeRun.runTalentXP, keywords);
}

export function awardBattleDodgeXP(
  draft: GameplayDraft,
  previousState: BattleSnapshot,
  resultState: BattleSnapshot,
): void {
  const amount = resultState.playerDodgeCount - previousState.playerDodgeCount;
  if (amount <= 0) return;
  draft.run.activeRun.runTalentXP = addTalentXP(draft.run.activeRun.runTalentXP, ["dodge"], amount);
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
  draft.session.activity = { kind: "idle" };
  Object.assign(draft.run.activeRun, runFieldsFromSnapshot(snapshot), {
    runTalentXP: {},
    runMaterialsEarned: emptyInventory(),
    runObtainedItems: [],
  });
}

export function setScreen(draft: GameplayDraft, action: Screen | ((prev: Screen) => Screen)): void {
  const screen = typeof action === "function" ? action(draft.run.navigation.screen) : action;
  draft.run.navigation.screen = screen;
  prepareRunNavigation(draft, screen);
}

export function prepareRunNavigation(draft: GameplayDraft, screen: Screen): void {
  if (draft.session.activity.kind !== "inactive")
    draft.session.activity = transitionRunActivity(draft.session.activity, screen);
}

export function resetNavigation(draft: GameplayDraft): void {
  draft.run.navigation.screen = "menu";
  draft.session.activity = { kind: "idle" };
}

export function createDraftRunRandomSource(draft: GameplayDraft, stream: RunRngStream): () => number {
  return () => nextRunRandom(draft, stream);
}

export function withDraftWorldBattleRng(draft: GameplayDraft, battleState: BattleSnapshot): BattleState {
  const snapshot = isDraft(battleState) ? current(battleState) : battleState;
  return { ...snapshot, rng: createDraftRunRandomSource(draft, "world") };
}

function hydrateBattleState(battleState: BattleSnapshot): BattleSnapshot {
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

export const snapshotBattleState = battleSnapshot;

export function setSyncedBattleState(
  draft: GameplayDraft,
  action: BattleSnapshot | ((prev: BattleSnapshot) => BattleSnapshot),
): void {
  const prev = draft.battle.battleState;
  draft.battle.battleState = battleSnapshot(typeof action === "function" ? action(prev) : action);
}

export function setBattleState(
  draft: GameplayDraft,
  action: BattleSnapshot | ((prev: BattleSnapshot) => BattleSnapshot),
): void {
  setSyncedBattleState(draft, (prev) => battleSnapshot(typeof action === "function" ? action(prev) : action));
  syncPurseFromBattleGold(draft);
}

function setPendingBattleTransition(draft: GameplayDraft, transition: PersistedBattleTransition | null): void {
  draft.battle.pendingBattleTransition = transition;
}

export function clearPendingTransitionResumeRequired(draft: GameplayDraft): void {
  draft.battle.pendingTransitionResumeRequired = false;
}

export function setBattleStartState(draft: GameplayDraft, state: BattleSnapshot | null): void {
  draft.battle.battleStartState = state ? battleSnapshot(state) : null;
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
    resultState: battleSnapshot(pendingBattleTransition.resultState),
  };
}

export function initializeActiveBattle(
  draft: GameplayDraft,
  battleState: BattleSnapshot | null,
  pendingBattleTransition?: PersistedBattleTransition | null,
): void {
  if (!battleState) {
    Object.assign(draft.battle, createInitialBattleFields());
    return;
  }
  const hydrated = battleSnapshot(hydrateBattleState(battleState));
  const pending = rebindPendingTransitionWorldRng(hydrateBattleTransition(pendingBattleTransition ?? null));
  const battle: Draft<RunDomainBattleState> = draft.battle;
  battle.battleState = hydrated;
  battle.pendingBattleTransition = pending;
  battle.pendingTransitionResumeRequired = pending != null;
  battle.battleStartState = hydrated;
  battle.hasActiveBattle = true;
  prepareRunNavigation(draft, "battle");
  syncBattleGoldFromPurse(draft);
}

export function commitBattleTransition(
  draft: GameplayDraft,
  battleState: BattleSnapshot,
  pendingBattleTransition: PersistedBattleTransition | null,
): void {
  setSyncedBattleState(draft, battleSnapshot(battleState));
  setPendingBattleTransition(draft, rebindPendingTransitionWorldRng(pendingBattleTransition));
  clearPendingTransitionResumeRequired(draft);
  syncPurseFromBattleGold(draft);
}
