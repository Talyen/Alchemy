// Public gameplay write capability for feature code.
// All write functions are grouped by domain in this single barrel — import from here only.
// Trivial single-action writes are bound through `bindWriteAction` so the public seam
// stays a one-line list of names; compound cross-lifetime writes stay explicit below.
import { getDifficultyXPMultiplier } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunRngStream } from "@/lib/run-rng";
import type { Destination } from "@/features/alchemy/shared/types";
import { bindWriteAction, dispatchRunSessionCommand } from "./run-session-command";
import { readGameplayState, type GameplayState } from "./gameplay-state-store";
import type { DisplayOverrides } from "./run-domain-types";

type RunActions = GameplayState["runActions"];
export type RunTrinketsUpdate = Parameters<RunActions["setRunTrinkets"]>[0];
export type RunDeckUpdate = Parameters<RunActions["setRunDeck"]>[0];

const runActions = (state: GameplayState) => state.runActions;
const sessionActions = (state: GameplayState) => state.sessionActions;
const runProfileActions = (state: GameplayState) => state.runProfileActions;
const battleActions = (state: GameplayState) => state.battleActions;

// ---------------------------------------------------------------------------
// Active-run progression
// ---------------------------------------------------------------------------

export const setRunDeck = bindWriteAction((s) => runActions(s).setRunDeck);
export const setRunGold = bindWriteAction((s) => runActions(s).setRunGold);
export const addRunGold = bindWriteAction((s) => runActions(s).addRunGold);
export const setRunPlayerHealth = bindWriteAction((s) => runActions(s).setRunPlayerHealth);
export const setRunMaxHealth = bindWriteAction((s) => runActions(s).setRunMaxHealth);
export const setRoomsEncountered = bindWriteAction((s) => runActions(s).setRoomsEncountered);
export const setCurrentAct = bindWriteAction((s) => runActions(s).setCurrentAct);
export const setDestinationIndexInAct = bindWriteAction((s) => runActions(s).setDestinationIndexInAct);
export const setCompletedDestinations = bindWriteAction((s) => runActions(s).setCompletedDestinations);
export const setDestinationOfferState = bindWriteAction((s) => runActions(s).setDestinationOfferState);
export const setRunTrinkets = bindWriteAction((s) => runActions(s).setRunTrinkets);
export const setEncounteredRunEnemyIds = bindWriteAction((s) => runActions(s).setEncounteredRunEnemyIds);
export const setScreen = bindWriteAction((s) => runActions(s).setScreen);
export const awardCardXP = bindWriteAction((s) => runActions(s).awardCardXP);
export const awardMysteryXP = bindWriteAction((s) => runActions(s).awardMysteryXP);
export const addRunMaterialsEarned = bindWriteAction((s) => runActions(s).addRunMaterialsEarned);
export const clearRunMaterialsEarned = bindWriteAction((s) => runActions(s).clearRunMaterialsEarned);

/** Draw from a persisted run stream without exposing the aggregate action. */
export function createRunRandomSource(stream: RunRngStream): () => number {
  return () => dispatchRunSessionCommand(() => readGameplayState().runActions.nextRunRandom(stream));
}

// ---------------------------------------------------------------------------
// Permanent profile (homestead, talents)
// ---------------------------------------------------------------------------

/** Persist homestead materials and track totals for the run-end summary screen. */
export function awardMaterialsDuringRun(materials: MaterialInventory) {
  dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    session.runProfileActions.addMaterials(materials);
    session.runActions.addRunMaterialsEarned(materials);
  });
}

export const setMaterials = bindWriteAction((s) => runProfileActions(s).setMaterials);
export const addMaterials = bindWriteAction((s) => runProfileActions(s).addMaterials);
export const constructBuilding = bindWriteAction((s) => runProfileActions(s).constructBuilding);
export const plantFarm = bindWriteAction((s) => runProfileActions(s).plantFarm);
export const completeResearch = bindWriteAction((s) => runProfileActions(s).completeResearch);
export const bondCompanion = bindWriteAction((s) => runProfileActions(s).bondCompanion);
export const unlockTalent = bindWriteAction((s) => runProfileActions(s).unlockTalent);
export const resetUnlockedTalents = bindWriteAction((s) => runProfileActions(s).resetUnlockedTalents);

/** Dev unlock-all: max every talent and drop pending run XP so run-end cannot merge on top. */
export function unlockAllTalents() {
  dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    session.runProfileActions.unlockAllTalents();
    session.runActions.resetRunXP();
  });
}

/**
 * Merge the finished run's talent XP into permanent progression and publish the
 * run-end snapshot the game-over / victory screens read. Idempotent: a second
 * call with no run XP left clears the snapshot instead of double-counting.
 */
export function finalizeRunXP(): void {
  dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    const runTalentXP = session.run.activeRun.runTalentXP;
    if (Object.keys(runTalentXP).length === 0) {
      session.sessionActions.setRunEndTalentXP({});
      return;
    }
    const multiplier = getDifficultyXPMultiplier(session.run.activeRun.selectedDifficulty);
    session.sessionActions.setRunEndTalentXP(
      session.runProfileActions.mergeRunTalentXPIntoProfile(runTalentXP, multiplier),
    );
    session.runActions.resetRunXP();
  });
}

// ---------------------------------------------------------------------------
// Battle
// ---------------------------------------------------------------------------

export const setBattleState = bindWriteAction((s) => battleActions(s).setSyncedBattleState);
export const setBattleStartState = bindWriteAction((s) => battleActions(s).setBattleStartState);
export const setHasActiveBattle = bindWriteAction((s) => battleActions(s).setHasActiveBattle);

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
  battleState: BattleState | null,
  pendingBattleTransition: PersistedBattleTransition | null = null,
): void {
  if (!battleState) {
    dispatchRunSessionCommand(() => readGameplayState().battleActions.initializeActiveBattle(null, null));
    return;
  }
  dispatchRunSessionCommand(() =>
    readGameplayState().battleActions.initializeActiveBattle(
      rebindBattleWorldRng(battleState),
      rebindPendingTransitionWorldRng(pendingBattleTransition),
    ),
  );
}

/** Commit the logical state and its async continuation as one durable revision. */
export function commitBattleTransition(
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition | null,
): void {
  dispatchRunSessionCommand(() => {
    const battle = readGameplayState().battleActions;
    battle.setSyncedBattleState(battleState);
    battle.setPendingBattleTransition(pendingBattleTransition);
    battle.clearPendingTransitionResumeRequired();
  });
}

/** Start a visible async transition while keeping its continuation in the save. */
export function beginBattleTransition(
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition,
  displayOverrides: DisplayOverrides,
): void {
  dispatchRunSessionCommand(() => {
    const battle = readGameplayState().battleActions;
    battle.setSyncedBattleState(battleState);
    battle.setPendingBattleTransition(pendingBattleTransition);
    battle.setDisplayOverrides(displayOverrides);
  });
}

export function clearBattleTransition(): void {
  dispatchRunSessionCommand(() => {
    const battle = readGameplayState().battleActions;
    battle.setPendingBattleTransition(null);
    battle.clearPendingTransitionResumeRequired();
  });
}

// ---------------------------------------------------------------------------
// Run setup (pending selections, draft, run-start application)
// ---------------------------------------------------------------------------

export const setPendingCharacterId = bindWriteAction((s) => sessionActions(s).setPendingCharacterId);
export const setPendingContentSystemType = bindWriteAction((s) => sessionActions(s).setPendingContentSystemType);
export const setWildwoodDraft = bindWriteAction((s) => sessionActions(s).setWildwoodDraft);

/** Start a fresh run: seed active-run progress, drop the previous run-end XP snapshot, flag the run active. */
export function applyRunStartSnapshot(snapshot: RunStartSnapshot): void {
  dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    session.runActions.hydrateFromSnapshot(snapshot);
    session.sessionActions.setRunEndTalentXP({});
    session.sessionActions.setHasActiveRun(snapshot.hasActiveRun);
  });
}

// ---------------------------------------------------------------------------
// Rewards / claims
// ---------------------------------------------------------------------------

export const setRewardState = bindWriteAction((s) => sessionActions(s).setRewardState);
export const setCompanionRewardCards = bindWriteAction((s) => sessionActions(s).setCompanionRewardCards);
export const beginRewardClaim = bindWriteAction((s) => sessionActions(s).beginRewardClaim);
export const releaseRewardClaim = bindWriteAction((s) => sessionActions(s).releaseRewardClaim);
export const beginDestinationClaim = bindWriteAction((s) => sessionActions(s).beginDestinationClaim);
export const cancelDestinationClaim = bindWriteAction((s) => sessionActions(s).cancelDestinationClaim);
export const setRunEndMaterials = bindWriteAction((s) => sessionActions(s).setRunEndMaterials);
export const setCorruptionResult = bindWriteAction((s) => sessionActions(s).setCorruptionResult);

/** Commit destination claim across session + active-run progress (cross-lifetime). */
export function commitDestinationClaim(destination: Destination): boolean {
  return dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    const transient = session.session;
    if (transient.pendingDestinationClaim !== destination) return false;
    if (!transient.rewardState.destinations.includes(destination)) {
      session.sessionActions.cancelDestinationClaim();
      return false;
    }
    session.sessionActions.setRewardState((prev) => ({ ...prev, destinations: [] }));
    session.sessionActions.cancelDestinationClaim();
    session.runActions.setCompletedDestinations((prev) => [...prev, destination]);
    session.runActions.setDestinationIndexInAct((prev) => prev + 1);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Shop / alchemist
// ---------------------------------------------------------------------------

export const setShopState = bindWriteAction((s) => sessionActions(s).setShopState);
export const setAlchemistState = bindWriteAction((s) => sessionActions(s).setAlchemistState);
export const setTrinketShopState = bindWriteAction((s) => sessionActions(s).setTrinketShopState);
export const setEquipmentShopState = bindWriteAction((s) => sessionActions(s).setEquipmentShopState);

// ---------------------------------------------------------------------------
// Mystery
// ---------------------------------------------------------------------------

export const setMysteryEvent = bindWriteAction((s) => sessionActions(s).setMysteryEvent);
export const setMysteryCardChoices = bindWriteAction((s) => sessionActions(s).setMysteryCardChoices);

// ---------------------------------------------------------------------------
// Labyrinth
// ---------------------------------------------------------------------------

export const setActiveLabyrinthModifiers = bindWriteAction((s) => sessionActions(s).setActiveLabyrinthModifiers);
export const setActiveLabyrinthRewardModifiers = bindWriteAction(
  (s) => sessionActions(s).setActiveLabyrinthRewardModifiers,
);
export const setActiveLabyrinthPendingNode = bindWriteAction((s) => sessionActions(s).setActiveLabyrinthPendingNode);
export const setLabyrinthMap = bindWriteAction((s) => sessionActions(s).setLabyrinthMap);
