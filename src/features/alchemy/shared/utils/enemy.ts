// Enemy formatting helpers for tooltip display and bestiary entries.
// Depends on game-data enemy types only.
// Used by EnemyTooltip and collection UI to render structured enemy data as text.
import { capitalizeWord } from "@/lib/utils";
import type { EnemyAttackEffect } from "@/lib/game-data";

function joinAttackTypes(types: string[]): string {
  // Enemy tooltips use natural-language joins so combined attacks read as one move.
  if (types.length <= 1) return types[0] ?? "Physical";
  if (types.length === 2) return `${types[0]} and ${types[1]}`;
  return `${types.slice(0, -1).join(", ")} and ${types[types.length - 1]}`;
}

function formatStatusAttackTypes(attackEffects: Array<Extract<EnemyAttackEffect, { kind: "player-status" }>>) {
  if (attackEffects.length === 1) {
    const e = attackEffects[0]!;
    return `Deals ${e.amount} ${capitalizeWord(e.status)} damage`;
  }
  const statusWithAmounts = attackEffects.map((e) => `${e.amount} ${capitalizeWord(e.status)}`);
  return `Deals ${joinAttackTypes(statusWithAmounts)}`;
}

// Converts attack effects into number-free description lines for tooltips.
// Each combat keyword gets its own line so enemy attacks scan like card text.
export function formatEnemyAttackLines(attackEffects: EnemyAttackEffect[]): string[] {
  if (attackEffects.length === 0) return ["Deals Physical damage"];

  if (attackEffects.every((e) => e.kind === "player-status")) {
    return [formatStatusAttackTypes(attackEffects)];
  }

  const damageEffects = attackEffects.filter((e) => e.kind === "damage");
  const statusEffects = attackEffects.filter((e) => e.kind === "player-status");
  if (damageEffects.length === 1 && statusEffects.length === 1 && !damageEffects[0]!.lifesteal) {
    return [
      `Deals ${joinAttackTypes([`${damageEffects[0]!.amount} ${capitalizeWord(damageEffects[0]!.damageType)}`, `${statusEffects[0]!.amount} ${capitalizeWord(statusEffects[0]!.status)}`])}`,
    ];
  }

  if (statusEffects.length === 0 && damageEffects.length > 1) {
    const parts = damageEffects.map((e) => `${e.amount} ${capitalizeWord(e.damageType)}`);
    return [`Deals ${joinAttackTypes(parts)}`];
  }

  // Mixed damage + status with lifesteal, or pure damage
  const lines: string[] = [];
  for (const effect of attackEffects) {
    if (effect.kind === "damage") {
      lines.push(`Deals ${effect.amount} ${capitalizeWord(effect.damageType)} damage`);
      if (effect.lifesteal) lines.push("Leech");
    } else {
      lines.push(`Deals ${effect.amount} ${capitalizeWord(effect.status)} damage`);
    }
  }
  return lines;
}
