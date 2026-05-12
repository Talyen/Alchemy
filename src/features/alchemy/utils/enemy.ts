// Enemy formatting helpers for tooltip display and bestiary entries.
// Depends on game-data enemy types only.
// Used by EnemyTooltip and collection UI to render structured enemy data as text.
import type { EnemyAttackEffect } from "@/lib/game-data";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Converts attack effects into number-free description lines for tooltips.
// Each combat keyword gets its own line so enemy attacks scan like card text.
export function formatEnemyAttackLines(attackEffects: EnemyAttackEffect[]): string[] {
  if (attackEffects.length === 0) return ["Deals Physical damage"];

  if (attackEffects.every((e) => e.kind === "player-status")) {
    return attackEffects.map((e) => `Deals ${capitalize(e.status)} damage`);
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
