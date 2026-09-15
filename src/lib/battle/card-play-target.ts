import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { forEachNestedEffect } from "./card-classification";

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
    case "companion-action":
    case "random-draw":
    case "lose-health":
    case "draw-cards":
    case "remove-harmful-status":
    case "remove-player-status":
    case "self-damage":
    case "next-hit-crit":
    case "next-hit-leech":
    case "play-next-card-twice":
    case "next-hit-poison":
    case "next-archery-free":
      return "player";
    case "chance":
    case "repeat-over-turns":
      return null;
  }
}

export function getBattleCardPlayTarget(card: BattleCard): "player" | "enemy" {
  let target: "player" | "enemy" | null = null;
  // Depth-first, in card order — the same sequence the previous recursive
  // walk visited — so the first concrete target still wins.
  forEachNestedEffect(card.effects, (effect) => {
    target ??= effectTarget(effect);
  });
  return target ?? "enemy";
}
