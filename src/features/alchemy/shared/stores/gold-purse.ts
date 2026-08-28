import type { GameplayDraft } from "./run-session-command";
import { getGoldMultiplier } from "@/lib/game-data";

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

export function setProfileGold(draft: GameplayDraft, action: number | ((prev: number) => number)): void {
  const next = typeof action === "function" ? action(draft.runProfile.gold) : action;
  draft.runProfile.gold = Math.max(0, next);
  syncBattleGoldFromPurse(draft);
}

export function addProfileGold(draft: GameplayDraft, amount: number): void {
  const mult = getGoldMultiplier(draft.run.activeRun.characterId, draft.run.activeRun.selectedDifficulty);
  setProfileGold(draft, (gold) => gold + Math.floor(amount * mult));
}

export function grantStartGold(draft: GameplayDraft, amount: number): void {
  if (amount <= 0) return;
  setProfileGold(draft, (gold) => gold + amount);
}
