// Enemy formatting helpers for tooltip display and bestiary entries.
// Depends on game-data enemy types only.
// Used by EnemyTooltip and collection UI to render structured enemy data as text.
import type { EnemyAttackEffect } from "@/lib/game-data";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joinAttackTypes(types: string[]): string {
  // Enemy tooltips use natural-language joins so combined attacks read as one move.
  if (types.length <= 1) return types[0] ?? "Physical";
  if (types.length === 2) return `${types[0]} and ${types[1]}`;
  return `${types.slice(0, -1).join(", ")} and ${types[types.length - 1]}`;
}

function formatStatusAttackTypes(attackEffects: Extract<EnemyAttackEffect, { kind: "player-status" }>[]) {
  // A single status reads like damage text; multiple statuses omit the repeated suffix.
  const statusTypes = attackEffects.map((effect) => capitalize(effect.status));
  if (statusTypes.length === 1) return `Deals ${statusTypes[0]} damage`;
  return `Deals ${joinAttackTypes(statusTypes)}`;
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
  if (damageEffects.length === 1 && statusEffects.length === 1 && !damageEffects[0].lifesteal) {
    return [`Deals ${joinAttackTypes([capitalize(damageEffects[0].damageType), capitalize(statusEffects[0].status)])} damage`];
  }

  // Mixed damage + status with lifesteal, or pure damage
  const lines: string[] = [];
  for (const effect of attackEffects) {
    if (effect.kind === "damage") {
      lines.push("Deals Physical damage");
      if (effect.lifesteal) lines.push("Leech");
    } else {
      lines.push(`Deals ${capitalize(effect.status)} damage`);
    }
  }
  return lines;
}
