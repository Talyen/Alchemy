import { computeGoldReward } from "@/lib/homestead/material-rewards";
import { addRunGoldEarned } from "./run-recap";
import { getGoldMultiplier } from "@/lib/game-data";
import type { GameplayDraft } from "../../session/gameplay-command";

// ── Gold (purse ⇄ battle mirror) ─────────────────────────────────────────────
// `runProfile.gold` is the purse; `battleState.gold` mirrors it while a battle
// is live. `setGold` syncs purse→battle; battle commits sync battle→purse via
// the battle module's `syncPurseFromBattleGold`.

export function readDraftGold(draft: GameplayDraft): number {
  return draft.runProfile.gold;
}

export function syncBattleGoldFromPurse(draft: GameplayDraft): void {
  if (draft.session.activity.kind !== "battle") return;
  draft.session.activity.data.battleState.gold = draft.runProfile.gold;
}

export function setGold(draft: GameplayDraft, action: number | ((previous: number) => number)): void {
  const next = typeof action === "function" ? action(draft.runProfile.gold) : action;
  draft.runProfile.gold = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, next));
  syncBattleGoldFromPurse(draft);
}

export function addGold(draft: GameplayDraft, amount: number, findBonus = 0): void {
  const multiplier = getGoldMultiplier(draft.run.activeRun.characterId, draft.run.activeRun.selectedDifficulty);
  const earned = computeGoldReward(amount, multiplier, findBonus);
  const previous = draft.runProfile.gold;
  setGold(draft, (gold) => gold + earned);
  addRunGoldEarned(draft, draft.runProfile.gold - previous);
}

export function deductGold(draft: GameplayDraft, amount: number): void {
  if (amount <= 0) return;
  setGold(draft, (gold) => Math.max(0, gold - amount));
}
