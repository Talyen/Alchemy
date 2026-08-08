// Public gameplay write capability for feature code.
// All write functions are grouped by domain in this single barrel — import from here only.
// Trivial single-action writes are bound through `bindDraftAction` so the public seam
// stays a one-line list of names; compound cross-lifetime writes stay explicit below.
import { getDifficultyXPMultiplier } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunRngStream } from "@/lib/run-rng";
import type { Destination } from "@/features/alchemy/shared/types";
import { bindDraftAction, dispatchRunSessionCommand, isGameplayDraft, type GameplayDraft } from "./run-session-command";
import { createGameplayDraftActions, readGameplayState } from "./gameplay-state-store";
import type { DisplayOverrides } from "./run-domain-types";

type RunActions = GameplayDraft["runActions"];
export type RunTrinketsUpdate = Parameters<RunActions["setRunTrinkets"]>[0];
export type RunDeckUpdate = Parameters<RunActions["setRunDeck"]>[0];

const draftActions = (state: GameplayDraft) => createGameplayDraftActions(state);
const runActions = (state: GameplayDraft) => draftActions(state).runActions;
const sessionActions = (state: GameplayDraft) => draftActions(state).sessionActions;
const runProfileActions = (state: GameplayDraft) => draftActions(state).runProfileActions;
const battleActions = (state: GameplayDraft) => draftActions(state).battleActions;

// ---------------------------------------------------------------------------
// Active-run progression
// ---------------------------------------------------------------------------

export const setRunDeck = bindDraftAction((s) => runActions(s).setRunDeck);
export const setRunGold = bindDraftAction((s) => runActions(s).setRunGold);
export const addRunGold = bindDraftAction((s) => runActions(s).addRunGold);
export const setRunPlayerHealth = bindDraftAction((s) => runActions(s).setRunPlayerHealth);
export const setRunMaxHealth = bindDraftAction((s) => runActions(s).setRunMaxHealth);
export const setRoomsEncountered = bindDraftAction((s) => runActions(s).setRoomsEncountered);
export const setCurrentAct = bindDraftAction((s) => runActions(s).setCurrentAct);
export const setDestinationIndexInAct = bindDraftAction((s) => runActions(s).setDestinationIndexInAct);
export const setCompletedDestinations = bindDraftAction((s) => runActions(s).setCompletedDestinations);
export const setSelectedDifficulty = bindDraftAction((s) => runActions(s).setSelectedDifficulty);
export const setContentSystemType = bindDraftAction((s) => runActions(s).setContentSystemType);
export const setDestinationOfferState = bindDraftAction((s) => runActions(s).setDestinationOfferState);
export const setRunTrinkets = bindDraftAction((s) => runActions(s).setRunTrinkets);
export const setEncounteredRunEnemyIds = bindDraftAction((s) => runActions(s).setEncounteredRunEnemyIds);
export const setScreen = bindDraftAction((s) => runActions(s).setScreen);
export const awardCardXP = bindDraftAction((s) => runActions(s).awardCardXP);
export const awardMysteryXP = bindDraftAction((s) => runActions(s).awardMysteryXP);
export const addRunMaterialsEarned = bindDraftAction((s) => runActions(s).addRunMaterialsEarned);
export const clearRunMaterialsEarned = bindDraftAction((s) => runActions(s).clearRunMaterialsEarned);

/** Draw from a persisted run stream without exposing the aggregate action. */
type RunRandomSource = (() => number) & { bindDraft?: (draft: GameplayDraft) => () => number };

export function createRunRandomSource(stream: RunRngStream, draft?: GameplayDraft): RunRandomSource {
  if (draft) {
    const nextRunRandom = draftActions(draft).runActions.nextRunRandom;
    return () => nextRunRandom(stream);
  }
  const source: RunRandomSource = () => readGameplayState().runActions.nextRunRandom(stream);
  source.bindDraft = (draft) => createRunRandomSource(stream, draft);
  return source;
}

export function bindRunRandomSource(source: () => number, draft: GameplayDraft): () => number {
  return (source as RunRandomSource).bindDraft?.(draft) ?? source;
}

// ---------------------------------------------------------------------------
// Permanent profile (homestead, talents)
// ---------------------------------------------------------------------------

/** Persist homestead materials and track totals for the run-end summary screen. */
export function awardMaterialsDuringRun(draft: GameplayDraft, materials: MaterialInventory): void;
export function awardMaterialsDuringRun(materials: MaterialInventory): void;
export function awardMaterialsDuringRun(
  draftOrMaterials: GameplayDraft | MaterialInventory,
  materials?: MaterialInventory,
): void {
  if (!isGameplayDraft(draftOrMaterials)) {
    dispatchRunSessionCommand((draft) => awardMaterialsDuringRun(draft, draftOrMaterials));
    return;
  }
  const draft = draftOrMaterials;
  draftActions(draft).runProfileActions.addMaterials(materials!);
  draftActions(draft).runActions.addRunMaterialsEarned(materials!);
}

export const setMaterials = bindDraftAction((s) => runProfileActions(s).setMaterials);
export const addMaterials = bindDraftAction((s) => runProfileActions(s).addMaterials);
export const constructBuilding = bindDraftAction((s) => runProfileActions(s).constructBuilding);
export const plantFarm = bindDraftAction((s) => runProfileActions(s).plantFarm);
export const completeResearch = bindDraftAction((s) => runProfileActions(s).completeResearch);
export const bondCompanion = bindDraftAction((s) => runProfileActions(s).bondCompanion);
export const unlockTalent = bindDraftAction((s) => runProfileActions(s).unlockTalent);
export const resetUnlockedTalents = bindDraftAction((s) => runProfileActions(s).resetUnlockedTalents);

/** Dev unlock-all: max every talent and drop pending run XP so run-end cannot merge on top. */
export function unlockAllTalents(draft?: GameplayDraft): void {
  if (!draft || !isGameplayDraft(draft)) {
    dispatchRunSessionCommand((nextDraft) => unlockAllTalents(nextDraft));
    return;
  }
  draftActions(draft).runProfileActions.unlockAllTalents();
  draftActions(draft).runActions.resetRunXP();
}

/**
 * Merge the finished run's talent XP into permanent progression and publish the
 * run-end snapshot the game-over / victory screens read. Idempotent: a second
 * call with no run XP left clears the snapshot instead of double-counting.
 */
export function finalizeRunXP(draft?: GameplayDraft): void {
  if (!draft || !isGameplayDraft(draft)) {
    dispatchRunSessionCommand((nextDraft) => finalizeRunXP(nextDraft));
    return;
  }
  const actions = draftActions(draft);
  const runTalentXP = draft.run.activeRun.runTalentXP;
  if (Object.keys(runTalentXP).length === 0) {
    actions.sessionActions.setRunEndTalentXP({});
    return;
  }
  const multiplier = getDifficultyXPMultiplier(draft.run.activeRun.selectedDifficulty);
  actions.sessionActions.setRunEndTalentXP(
    actions.runProfileActions.mergeRunTalentXPIntoProfile(runTalentXP, multiplier),
  );
  actions.runActions.resetRunXP();
}

// ---------------------------------------------------------------------------
// Battle
// ---------------------------------------------------------------------------

export const setBattleState = bindDraftAction((s) => battleActions(s).setSyncedBattleState);
export const setBattleStartState = bindDraftAction((s) => battleActions(s).setBattleStartState);
export const setHasActiveBattle = bindDraftAction((s) => battleActions(s).setHasActiveBattle);

function rebindBattleWorldRng(battleState: BattleState): BattleState {
  return { ...battleState, rng: createRunRandomSource("world") };
}

function rebindPendingTransitionWorldRng(
  pendingBattleTransition: PersistedBattleTransition | null,
): PersistedBattleTransition | null {
  if (!pendingBattleTransition || pendingBattleTransition.kind !== "enemy-turn") return pendingBattleTransition;
  return {
    ...pendingBattleTransition,
    resultState: rebindBattleWorldRng(pendingBattleTransition.resultState),
  };
}

export function initializeActiveBattle(
  draft: GameplayDraft,
  battleState: BattleState | null,
  pendingBattleTransition?: PersistedBattleTransition | null,
): void;
export function initializeActiveBattle(
  battleState: BattleState | null,
  pendingBattleTransition?: PersistedBattleTransition | null,
): void;
export function initializeActiveBattle(
  draftOrBattleState: GameplayDraft | BattleState | null,
  battleStateOrPending?: BattleState | PersistedBattleTransition | null,
  pendingBattleTransition?: PersistedBattleTransition | null,
): void {
  if (!isGameplayDraft(draftOrBattleState)) {
    dispatchRunSessionCommand((draft) =>
      initializeActiveBattle(draft, draftOrBattleState, battleStateOrPending as PersistedBattleTransition | null),
    );
    return;
  }
  const draft = draftOrBattleState;
  const actions = draftActions(draft);
  const battleState = battleStateOrPending as BattleState | null;
  if (!battleState) {
    actions.battleActions.initializeActiveBattle(null, null);
    return;
  }
  actions.battleActions.initializeActiveBattle(
    rebindBattleWorldRng(battleState),
    rebindPendingTransitionWorldRng(pendingBattleTransition ?? null),
  );
}

/** Commit the logical state and its async continuation as one durable revision. */
export function commitBattleTransition(
  draft: GameplayDraft,
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition | null,
): void;
export function commitBattleTransition(
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition | null,
): void;
export function commitBattleTransition(
  draftOrBattleState: GameplayDraft | BattleState,
  battleStateOrPending: BattleState | PersistedBattleTransition | null,
  pendingBattleTransition?: PersistedBattleTransition | null,
): void {
  if (!isGameplayDraft(draftOrBattleState)) {
    dispatchRunSessionCommand((draft) =>
      commitBattleTransition(draft, draftOrBattleState, battleStateOrPending as PersistedBattleTransition | null),
    );
    return;
  }
  const draft = draftOrBattleState;
  const battleState = battleStateOrPending as BattleState;
  const battle = draftActions(draft).battleActions;
  battle.setSyncedBattleState(battleState);
  battle.setPendingBattleTransition(pendingBattleTransition ?? null);
  battle.clearPendingTransitionResumeRequired();
}

/** Start a visible async transition while keeping its continuation in the save. */
export function beginBattleTransition(
  draft: GameplayDraft,
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition,
  displayOverrides: DisplayOverrides,
): void;
export function beginBattleTransition(
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition,
  displayOverrides: DisplayOverrides,
): void;
export function beginBattleTransition(
  draftOrBattleState: GameplayDraft | BattleState,
  battleStateOrPending: BattleState | PersistedBattleTransition,
  pendingOrDisplay: PersistedBattleTransition | DisplayOverrides,
  displayOverrides?: DisplayOverrides,
): void {
  if (!isGameplayDraft(draftOrBattleState)) {
    dispatchRunSessionCommand((draft) =>
      beginBattleTransition(
        draft,
        draftOrBattleState,
        battleStateOrPending as PersistedBattleTransition,
        pendingOrDisplay as DisplayOverrides,
      ),
    );
    return;
  }
  const draft = draftOrBattleState;
  const battleState = battleStateOrPending as BattleState;
  const pendingBattleTransition = pendingOrDisplay as PersistedBattleTransition;
  const battle = draftActions(draft).battleActions;
  battle.setSyncedBattleState(battleState);
  battle.setPendingBattleTransition(pendingBattleTransition);
  battle.setDisplayOverrides(displayOverrides!);
}

export function clearBattleTransition(draft?: GameplayDraft): void {
  if (!draft || !isGameplayDraft(draft)) {
    dispatchRunSessionCommand((nextDraft) => clearBattleTransition(nextDraft));
    return;
  }
  const battle = draftActions(draft).battleActions;
  battle.setPendingBattleTransition(null);
  battle.clearPendingTransitionResumeRequired();
}

// ---------------------------------------------------------------------------
// Run setup (pending selections, draft, run-start application)
// ---------------------------------------------------------------------------

export const setPendingCharacterId = bindDraftAction((s) => sessionActions(s).setPendingCharacterId);
export const setPendingContentSystemType = bindDraftAction((s) => sessionActions(s).setPendingContentSystemType);
export const setWildwoodDraft = bindDraftAction((s) => sessionActions(s).setWildwoodDraft);

/** Start a fresh run: seed active-run progress, drop the previous run-end XP snapshot, flag the run active. */
export function applyRunStartSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void;
export function applyRunStartSnapshot(snapshot: RunStartSnapshot): void;
export function applyRunStartSnapshot(
  draftOrSnapshot: GameplayDraft | RunStartSnapshot,
  snapshot?: RunStartSnapshot,
): void {
  if (!isGameplayDraft(draftOrSnapshot)) {
    dispatchRunSessionCommand((draft) => applyRunStartSnapshot(draft, draftOrSnapshot));
    return;
  }
  const draft = draftOrSnapshot;
  const actions = draftActions(draft);
  actions.runActions.hydrateFromSnapshot(snapshot!);
  actions.sessionActions.setRunEndTalentXP({});
  actions.sessionActions.setHasActiveRun(snapshot!.hasActiveRun);
}

// ---------------------------------------------------------------------------
// Rewards / claims
// ---------------------------------------------------------------------------

export const setRewardState = bindDraftAction((s) => sessionActions(s).setRewardState);
export const setCompanionRewardCards = bindDraftAction((s) => sessionActions(s).setCompanionRewardCards);
export const beginRewardClaim = bindDraftAction((s) => sessionActions(s).beginRewardClaim);
export const releaseRewardClaim = bindDraftAction((s) => sessionActions(s).releaseRewardClaim);
export const beginDestinationClaim = bindDraftAction((s) => sessionActions(s).beginDestinationClaim);
export const cancelDestinationClaim = bindDraftAction((s) => sessionActions(s).cancelDestinationClaim);
export const setRunEndMaterials = bindDraftAction((s) => sessionActions(s).setRunEndMaterials);
export const setCorruptionResult = bindDraftAction((s) => sessionActions(s).setCorruptionResult);

/** Commit destination claim across session + active-run progress (cross-lifetime). */
export function commitDestinationClaim(draft: GameplayDraft, destination: Destination): boolean;
export function commitDestinationClaim(destination: Destination): boolean;
export function commitDestinationClaim(
  draftOrDestination: GameplayDraft | Destination,
  destination?: Destination,
): boolean {
  if (!isGameplayDraft(draftOrDestination)) {
    return dispatchRunSessionCommand((draft) => commitDestinationClaim(draft, draftOrDestination));
  }
  const draft = draftOrDestination;
  const actions = draftActions(draft);
  const claimedDestination = destination!;
  const transient = draft.session;
  if (transient.pendingDestinationClaim !== claimedDestination) return false;
  if (!transient.rewardState.destinations.includes(claimedDestination)) {
    actions.sessionActions.cancelDestinationClaim();
    return false;
  }
  actions.sessionActions.setRewardState((prev) => ({ ...prev, destinations: [] }));
  actions.sessionActions.cancelDestinationClaim();
  actions.runActions.setCompletedDestinations((prev) => [...prev, claimedDestination]);
  actions.runActions.setDestinationIndexInAct((prev) => prev + 1);
  return true;
}

// ---------------------------------------------------------------------------
// Shop / alchemist
// ---------------------------------------------------------------------------

export const setShopState = bindDraftAction((s) => sessionActions(s).setShopState);
export const setAlchemistState = bindDraftAction((s) => sessionActions(s).setAlchemistState);
export const setTrinketShopState = bindDraftAction((s) => sessionActions(s).setTrinketShopState);
export const setEquipmentShopState = bindDraftAction((s) => sessionActions(s).setEquipmentShopState);

// ---------------------------------------------------------------------------
// Mystery
// ---------------------------------------------------------------------------

export const setMysteryEvent = bindDraftAction((s) => sessionActions(s).setMysteryEvent);
export const setMysteryCardChoices = bindDraftAction((s) => sessionActions(s).setMysteryCardChoices);

// ---------------------------------------------------------------------------
// Labyrinth
// ---------------------------------------------------------------------------

export const setActiveLabyrinthModifiers = bindDraftAction((s) => sessionActions(s).setActiveLabyrinthModifiers);
export const setActiveLabyrinthRewardModifiers = bindDraftAction(
  (s) => sessionActions(s).setActiveLabyrinthRewardModifiers,
);
export const setActiveLabyrinthPendingNode = bindDraftAction((s) => sessionActions(s).setActiveLabyrinthPendingNode);
export const setLabyrinthMap = bindDraftAction((s) => sessionActions(s).setLabyrinthMap);
