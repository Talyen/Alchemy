import { addRunGoldEarned } from "./run-recap";
import { battleSnapshot, type BattleSnapshot, type BattleState } from "@/lib/battle";
import { current, isDraft } from "immer";
import type { GameplayDraft } from "../run-session-command";
import { createInitialBattleFields } from "../run-domain-types";
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

export function setBattleStartState(draft: GameplayDraft, state: BattleSnapshot | null): void {
  draft.battle.battleStartState = state ? battleSnapshot(state) : null;
}

export function setHasActiveBattle(draft: GameplayDraft, active: boolean | ((previous: boolean) => boolean)): void {
  draft.battle.hasActiveBattle = typeof active === "function" ? active(draft.battle.hasActiveBattle) : active;
}

export function initializeActiveBattle(draft: GameplayDraft, battleState: BattleSnapshot | null): void {
  if (!battleState) {
    Object.assign(draft.battle, createInitialBattleFields());
    return;
  }
  const hydrated = battleSnapshot(battleState);
  const battle = draft.battle;
  battle.battleState = hydrated;
  battle.battleStartState = hydrated;
  battle.hasActiveBattle = true;
  prepareRunNavigation(draft, "battle");
  syncBattleGoldFromPurse(draft);
}

/** Commit engine output as a resource change, never as a replacement of the live purse. */
export function commitResolvedBattle(draft: GameplayDraft, before: BattleSnapshot, after: BattleSnapshot): void {
  const goldDelta = after.gold - before.gold;
  const gold = draft.battle.hasActiveBattle ? Math.max(0, draft.runProfile.gold + goldDelta) : after.gold;
  setSyncedBattleState(draft, { ...after, gold });
  if (draft.battle.hasActiveBattle) {
    addRunGoldEarned(draft, Math.max(0, goldDelta));
    draft.runProfile.gold = gold;
  }
}
