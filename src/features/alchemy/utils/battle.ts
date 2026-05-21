// Battle UI formatting helpers for combat text colors/icons and status chip ordering.
// Depends on battle state, game-data status IDs, alchemy config, and shared UI types.
// Used by battle controller and widgets to keep presentation derivation out of combat logic.
import type { BattleState, CombatTextEvent } from "@/lib/battle";
import {
  ENEMY_STATUS_DISPLAY_ORDER,
  PLAYER_STATUS_DISPLAY_ORDER,
  type KeywordId,
  keywordDefinitions,
} from "@/lib/game-data";
import { combatTextIconClasses, keywordIcons } from "../config";
import type { StatusChip } from "../types";

export function getCombatTextColorClass(event: CombatTextEvent): string {
  if (event.kind === "heal") return "text-green-400";
  const kw = keywordDefinitions[event.stat as KeywordId];
  if (kw) return kw.colorClass;
  if (event.stat === "haste") return "text-fuchsia-300";
  return "text-muted-foreground";
}

export function getCombatTextIcon(event: CombatTextEvent) {
  if (event.kind === "heal") return keywordIcons.health;
  const kw = keywordIcons[event.stat as KeywordId];
  if (kw) return kw;
  return combatTextIconClasses[event.stat];
}

export function getPlayerStatusChips(state: BattleState | null | undefined): StatusChip[] {
  if (!state) return [];
  return PLAYER_STATUS_DISPLAY_ORDER.reduce<StatusChip[]>((chips, id) => {
    const value = state.playerStatuses[id];
    if (value > 0) chips.push({ id, value });
    return chips;
  }, []);
}

export function getEnemyStatusChips(state: BattleState | null | undefined): StatusChip[] {
  if (!state) return [];
  return ENEMY_STATUS_DISPLAY_ORDER.reduce<StatusChip[]>((chips, id) => {
    const value = state.enemyStatuses[id];
    if (value > 0) chips.push({ id, value });
    return chips;
  }, []);
}
