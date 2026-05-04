import type { BattleState, CombatTextEvent } from "@/lib/battle";
import { type EnemyStatusId, type PlayerStatusId } from "@/lib/game-data";
import { combatTextColorClasses, combatTextIconClasses, keywordIcons } from "../config";
import type { StatusChip } from "../types";

export function getCombatTextColorClass(event: CombatTextEvent): string {
  if (event.kind === "damage" && event.stat === "health") return "text-red-400";
  if (event.kind === "damage" || event.kind === "status") return combatTextColorClasses[event.stat] ?? "text-muted-foreground";
  return "text-green-400";
}

export function getCombatTextIcon(event: CombatTextEvent) {
  if (event.kind === "heal") return keywordIcons.health;
  return combatTextIconClasses[event.stat];
}

export function getPlayerStatusChips(state: BattleState): StatusChip[] {
  const order: PlayerStatusId[] = ["block", "armor", "forge", "haste", "burn", "poison", "bleed", "freeze", "stun"];
  return order.reduce<StatusChip[]>((chips, id) => {
    const value = state.playerStatuses[id];
    if (value > 0) chips.push({ id, value });
    return chips;
  }, []);
}

export function getEnemyStatusChips(state: BattleState): StatusChip[] {
  const order: EnemyStatusId[] = ["burn", "poison", "bleed", "freeze", "stun"];
  return order.reduce<StatusChip[]>((chips, id) => {
    const value = state.enemyStatuses[id];
    if (value > 0) chips.push({ id, value });
    return chips;
  }, []);
}
