import type { BattleCard, BattleCardEffect } from "@/lib/game-data";

function effectTarget(effect: BattleCardEffect): "player" | "enemy" | null {
  switch (effect.kind) {
    case "damage":
    case "random-damage":
    case "enemy-status":
    case "remove-enemy-armor":
    case "multiply-enemy-status":
    case "cleanse-player-status-to-damage":
      return "enemy";
    case "player-status":
    case "heal":
    case "restore-mana":
    case "lose-mana":
    case "lose-max-mana":
    case "gain-max-mana":
    case "gain-gold":
    case "wish":
    case "summon-companion":
    case "buff-companion":
    case "lose-health":
    case "draw-cards":
    case "remove-harmful-status":
    case "remove-player-status":
    case "self-damage":
    case "next-hit-crit":
    case "play-next-card-twice":
    case "next-hit-poison":
      return "player";
    case "chance":
      for (const nested of [...effect.successEffects, ...effect.failureEffects]) {
        const target = effectTarget(nested);
        if (target) return target;
      }
      return null;
    case "repeat-over-turns":
      for (const nested of effect.effects) {
        const target = effectTarget(nested);
        if (target) return target;
      }
      return null;
  }
}

export function getBattleCardPlayTarget(card: BattleCard): "player" | "enemy" {
  for (const effect of card.effects) {
    const target = effectTarget(effect);
    if (target) return target;
  }
  return "enemy";
}
