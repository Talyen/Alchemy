import { addRunGoldEarned } from "./run-recap";
import { getGoldMultiplier } from "@/lib/game-data";
import type { GameplayDraft } from "../run-session-command";

// ── Gold (purse ⇄ battle mirror) ─────────────────────────────────────────────
// `runProfile.gold` is the purse; `battleState.gold` mirrors it while a battle
// is live. `setGold` syncs purse→battle; battle commits sync battle→purse via
// the battle module's `syncPurseFromBattleGold`.

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

export function setGold(draft: GameplayDraft, action: number | ((previous: number) => number)): void {
  const next = typeof action === "function" ? action(draft.runProfile.gold) : action;
  draft.runProfile.gold = Math.max(0, next);
  syncBattleGoldFromPurse(draft);
}

export function addGold(draft: GameplayDraft, amount: number): void {
  const multiplier = getGoldMultiplier(draft.run.activeRun.characterId, draft.run.activeRun.selectedDifficulty);
  const earned = Math.round(amount * multiplier);
  addRunGoldEarned(draft, earned);
  setGold(draft, (gold) => gold + earned);
}

export function grantStartGold(draft: GameplayDraft, amount: number): void {
  if (amount <= 0) return;
  setGold(draft, (gold) => gold + amount);
}

export function deductGold(draft: GameplayDraft, amount: number): void {
  if (amount <= 0) return;
  setGold(draft, (gold) => Math.max(0, gold - amount));
}
