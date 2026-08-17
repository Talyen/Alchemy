// Public gameplay write capability for feature code.
// All write functions are grouped by domain in this single barrel — import from here only.
// Every export is an explicit draft-first mutator. Event handlers own the surrounding
// `dispatchRunSessionCommand`; compound recipes compose these helpers without nesting.
import { getDifficultyXPMultiplier } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunRngStream } from "@/lib/run-rng";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import { bindDraftAction, type GameplayDraft } from "./run-session-command";
import {
  createGameplayDraftBattleActions,
  createGameplayDraftRunActions,
  createGameplayDraftRunProfileActions,
  createGameplayDraftSessionActions,
  readGameplayState,
} from "./gameplay-state-store";
import type { DisplayOverrides } from "./run-domain-types";

const runActions = (state: GameplayDraft) => createGameplayDraftRunActions(state);
const sessionActions = (state: GameplayDraft) => createGameplayDraftSessionActions(state);
const runProfileActions = (state: GameplayDraft) => createGameplayDraftRunProfileActions(state);
const battleActions = (state: GameplayDraft) => createGameplayDraftBattleActions(state);

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
export function createRunRandomSource(stream: RunRngStream): () => number {
  return () => readGameplayState().runActions.nextRunRandom(stream);
}

export function createDraftRunRandomSource(draft: GameplayDraft, stream: RunRngStream): () => number {
  const nextRunRandom = runActions(draft).nextRunRandom;
  return () => nextRunRandom(stream);
}

// ---------------------------------------------------------------------------
// Permanent profile (homestead, talents)
// ---------------------------------------------------------------------------

/** Persist homestead materials and track totals for the run-end summary screen. */
export function awardMaterialsDuringRun(draft: GameplayDraft, materials: MaterialInventory): void {
  runProfileActions(draft).addMaterials(materials);
  runActions(draft).addRunMaterialsEarned(materials);
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
export function unlockAllTalents(draft: GameplayDraft): void {
  runProfileActions(draft).unlockAllTalents();
  runActions(draft).resetRunXP();
}

/**
 * Merge the finished run's talent XP into permanent progression and publish the
 * run-end snapshot the game-over / victory screens read. Idempotent: a second
 * call with no run XP left clears the snapshot instead of double-counting.
 */
export function finalizeRunXP(draft: GameplayDraft): void {
  const run = runActions(draft);
  const session = sessionActions(draft);
  const runProfile = runProfileActions(draft);
  const runTalentXP = draft.run.activeRun.runTalentXP;
  if (Object.keys(runTalentXP).length === 0) {
    session.setRunEndTalentXP({});
    return;
  }
  const multiplier = getDifficultyXPMultiplier(draft.run.activeRun.selectedDifficulty);
  session.setRunEndTalentXP(runProfile.mergeRunTalentXPIntoProfile(runTalentXP, multiplier));
  run.resetRunXP();
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
): void {
  const battle = battleActions(draft);
  if (!battleState) {
    battle.initializeActiveBattle(null, null);
    return;
  }
  battle.initializeActiveBattle(
    rebindBattleWorldRng(battleState),
    rebindPendingTransitionWorldRng(pendingBattleTransition ?? null),
  );
}

/** Commit the logical state and its async continuation as one durable revision. */
export function commitBattleTransition(
  draft: GameplayDraft,
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition | null,
): void {
  const battle = battleActions(draft);
  battle.setSyncedBattleState(battleState);
  battle.setPendingBattleTransition(pendingBattleTransition);
  battle.clearPendingTransitionResumeRequired();
}

/** Start a visible async transition while keeping its continuation in the save. */
export function beginBattleTransition(
  draft: GameplayDraft,
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition,
  displayOverrides: DisplayOverrides,
): void {
  const battle = battleActions(draft);
  battle.setSyncedBattleState(battleState);
  battle.setPendingBattleTransition(pendingBattleTransition);
  battle.setDisplayOverrides(displayOverrides);
}

export function clearBattleTransition(draft: GameplayDraft): void {
  const battle = battleActions(draft);
  battle.setPendingBattleTransition(null);
  battle.clearPendingTransitionResumeRequired();
}

// ---------------------------------------------------------------------------
// Run setup (pending selections, draft, run-start application)
// ---------------------------------------------------------------------------

export const setPendingCharacterId = bindDraftAction((s) => sessionActions(s).setPendingCharacterId);
export const setPendingContentSystemType = bindDraftAction((s) => sessionActions(s).setPendingContentSystemType);
export const setWildwoodDraft = bindDraftAction((s) => sessionActions(s).setWildwoodDraft);
export const setStarterDraftChoices = bindDraftAction((s) => sessionActions(s).setStarterDraftChoices);

/** Start a fresh run: seed active-run progress, drop the previous run-end XP snapshot, flag the run active. */
export function applyRunStartSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  const run = runActions(draft);
  const session = sessionActions(draft);
  run.hydrateFromSnapshot(snapshot);
  session.setRunEndTalentXP({});
  session.setHasActiveRun(snapshot.hasActiveRun);
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
export function commitDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  const run = runActions(draft);
  const session = sessionActions(draft);
  const transient = draft.session;
  if (transient.pendingDestinationClaim !== destination) return false;
  if (!transient.rewardState.destinations.includes(destination)) {
    session.cancelDestinationClaim();
    return false;
  }
  if (draft.run.activeRun.lastOfferedDestinations.length === 0) {
    run.setDestinationOfferState({
      lastOfferedDestinations: [...transient.rewardState.destinations],
      roundsSinceOffered: { ...draft.run.activeRun.destinationRoundsSinceOffered },
    });
  }
  session.setRewardState((prev) => ({ ...prev, destinations: [] }));
  session.cancelDestinationClaim();
  run.setCompletedDestinations((prev) => [...prev, destination]);
  run.setDestinationIndexInAct((prev) => prev + 1);
  return true;
}

/** Undo a destination visit that never resolved so the same picker returns. */
export function abandonDestinationVisit(draft: GameplayDraft, destination: Destination): void {
  const run = runActions(draft);
  const session = sessionActions(draft);
  const transient = draft.session;

  if (transient.pendingDestinationClaim === destination) {
    session.cancelDestinationClaim();
  } else if (draft.run.activeRun.completedDestinations.at(-1) === destination) {
    run.setCompletedDestinations((prev) => prev.slice(0, -1));
    run.setDestinationIndexInAct((prev) => Math.max(0, prev - 1));
  }

  if (transient.rewardState.destinations.length === 0) {
    const restored = [...draft.run.activeRun.lastOfferedDestinations];
    if (restored.length > 0) {
      session.setRewardState((prev) => ({ ...prev, destinations: restored }));
    }
  }

  if (destination === DESTINATIONS.CORRUPTION) {
    session.setCorruptionResult(null);
  }
}

/** Undo a Corruption visit that never mutated a card so the same destination picker returns. */
export function abandonCorruptionDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.CORRUPTION);
}

/** Undo a Mystery visit whose event could not be restored. */
export function abandonMysteryDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.MYSTERY);
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
export const setMysteryChosenChoice = bindDraftAction((s) => sessionActions(s).setMysteryChosenChoice);
export const setMysteryPendingRemoval = bindDraftAction((s) => sessionActions(s).setMysteryPendingRemoval);
export const setMysteryCardChoices = bindDraftAction((s) => sessionActions(s).setMysteryCardChoices);
export const setMysteryGrantedTrinketIds = bindDraftAction((s) => sessionActions(s).setMysteryGrantedTrinketIds);
export const setMysteryGrantedGearInstances = bindDraftAction((s) => sessionActions(s).setMysteryGrantedGearInstances);
export const setMysteryChosenCardId = bindDraftAction((s) => sessionActions(s).setMysteryChosenCardId);

export function clearMysteryVisitState(draft: GameplayDraft): void {
  setMysteryEvent(draft, null);
  setMysteryChosenChoice(draft, null);
  setMysteryPendingRemoval(draft, false);
  setMysteryCardChoices(draft, null);
  setMysteryGrantedTrinketIds(draft, []);
  setMysteryGrantedGearInstances(draft, []);
  setMysteryChosenCardId(draft, null);
}

// ---------------------------------------------------------------------------
// Labyrinth
// ---------------------------------------------------------------------------

export const setActiveLabyrinthModifiers = bindDraftAction((s) => sessionActions(s).setActiveLabyrinthModifiers);
export const setActiveLabyrinthRewardModifiers = bindDraftAction(
  (s) => sessionActions(s).setActiveLabyrinthRewardModifiers,
);
export const setActiveLabyrinthPendingNode = bindDraftAction((s) => sessionActions(s).setActiveLabyrinthPendingNode);
export const setLabyrinthMap = bindDraftAction((s) => sessionActions(s).setLabyrinthMap);
