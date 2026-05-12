// Enemy formatting helpers for tooltip display and bestiary entries.
// Depends on game-data enemy types only.
// Used by EnemyTooltip and collection UI to render structured enemy data as text.
import type { EnemyAttackEffect } from "@/lib/game-data";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Converts attack effects into number-free description lines for tooltips.
// Pure-status enemies produce a single combined line; mixed damage+status enemies
// produce one line per effect so multi-part attacks render as a list.
export function formatEnemyAttackLines(attackEffects: EnemyAttackEffect[]): string[] {
  if (attackEffects.length === 0) return ["Deals Physical damage"];

  if (attackEffects.every((e) => e.kind === "player-status")) {
    // Only status effects — combine into one descriptive line
    const names = attackEffects.map((e) => capitalize(e.status));
    if (names.length === 1) return [`Deals ${names[0]} damage`];
    if (names.length === 2) return [`Deals ${names[0]} and ${names[1]}`];
    return [`Deals ${names.slice(0, -1).join(", ")} and ${names.slice(-1)}`];
  }

  // Single physical damage + single status without lifesteal — combine into one line
  if (attackEffects.length === 2) {
    const phys = attackEffects.find((e) => e.kind === "damage" && !e.lifesteal);
    const status = attackEffects.find((e) => e.kind === "player-status");
    if (phys && status) {
      return [`Deals Physical and ${capitalize(status.status)} damage`];
    }
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
