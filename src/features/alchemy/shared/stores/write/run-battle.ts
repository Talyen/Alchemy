import { addRunGoldEarned } from "./run-recap";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import { battleSnapshot, type BattleSnapshot, type BattleState } from "@/lib/battle";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { current, isDraft, type Draft } from "immer";
import type { GameplayDraft } from "../run-session-command";
import { createInitialBattleFields, type RunDomainBattleState } from "../run-domain-types";
import { createDraftRunRandomSource } from "./run-progress";
import { syncBattleGoldFromPurse } from "./run-gold";
import { prepareRunNavigation } from "./run-navigation";

// ── Battle ───────────────────────────────────────────────────────────────────

function syncPurseFromBattleGold(draft: GameplayDraft): void {
  if (!draft.battle.hasActiveBattle) return;
  const gold = Math.max(0, draft.battle.battleState.gold);
  addRunGoldEarned(draft, Math.max(0, gold - draft.runProfile.gold));
  draft.runProfile.gold = gold;
}

function hydrateBattleState(battleState: BattleSnapshot): BattleSnapshot {
  // Piles are re-hydrated against the card catalog so resumed battles pick up
  // catalog fixes. `pendingTurnStartEffects` (queued card effects + sourceCard)
  // is intentionally preserved as saved: those effects were already rolled and
  // mid-flight when the save was written, so re-hydrating them to the current
  // catalog would change the outcome of an in-flight turn.
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

function hydratePersistedTransition(transition: PersistedBattleTransition | null): PersistedBattleTransition | null {
  // battleSnapshot strips runtime-only fields (live rng fns) so the committed
  // pending transition stays serializable; hydrateBattleState revives cards.
  if (!transition || !("resultState" in transition)) return transition;
  return {
    ...transition,
    resultState: battleSnapshot(hydrateBattleState(transition.resultState)),
  };
}

export const snapshotBattleState = battleSnapshot;

export function withDraftWorldBattleRng(draft: GameplayDraft, battleState: BattleSnapshot): BattleState {
  const snapshot = isDraft(battleState) ? current(battleState) : battleState;
  return { ...snapshot, rng: createDraftRunRandomSource(draft, "world") };
}

export function setSyncedBattleState(
  draft: GameplayDraft,
  action: BattleSnapshot | ((previous: BattleSnapshot) => BattleSnapshot),
): void {
  const previous = draft.battle.battleState;
  draft.battle.battleState = battleSnapshot(typeof action === "function" ? action(previous) : action);
}

export function setBattleState(
  draft: GameplayDraft,
  action: BattleSnapshot | ((previous: BattleSnapshot) => BattleSnapshot),
): void {
  // setSyncedBattleState already strips runtime-only fields via battleSnapshot;
  // do not snapshot twice.
  setSyncedBattleState(draft, action);
  syncPurseFromBattleGold(draft);
}

export function clearPendingTransitionResumeRequired(draft: GameplayDraft): void {
  draft.battle.pendingTransitionResumeRequired = false;
}

export function setBattleStartState(draft: GameplayDraft, state: BattleSnapshot | null): void {
  draft.battle.battleStartState = state ? battleSnapshot(state) : null;
}

export function setHasActiveBattle(draft: GameplayDraft, active: boolean | ((previous: boolean) => boolean)): void {
  draft.battle.hasActiveBattle = typeof active === "function" ? active(draft.battle.hasActiveBattle) : active;
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
  const pending = hydratePersistedTransition(pendingBattleTransition ?? null);
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
  setSyncedBattleState(draft, battleState);
  draft.battle.pendingBattleTransition = hydratePersistedTransition(pendingBattleTransition);
  clearPendingTransitionResumeRequired(draft);
  syncPurseFromBattleGold(draft);
}
