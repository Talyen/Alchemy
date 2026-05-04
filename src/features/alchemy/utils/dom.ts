import type { MouseEvent } from "react";
import type { BattleCard } from "@/lib/game-data";
import type { CardRect } from "../types";

export function getCardRect(element: DOMRect): CardRect {
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}

export function setTiltFromEvent(event: MouseEvent<HTMLElement>) {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  const strength = Number(target.dataset.tiltStrength ?? 10);
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  target.style.setProperty("--tilt-rotate-y", `${(x - 0.5) * strength}deg`);
  target.style.setProperty("--tilt-rotate-x", `${(0.5 - y) * strength}deg`);
}

export function clearTiltFromEvent(event: MouseEvent<HTMLElement>) {
  const target = event.currentTarget;
  target.style.setProperty("--tilt-rotate-y", "0deg");
  target.style.setProperty("--tilt-rotate-x", "0deg");
}

export function getBattleCardPlayTarget(card: BattleCard): "player" | "enemy" {
  for (const effect of card.effects) {
    if (effect.kind === "damage") return "enemy";
    if (effect.kind === "player-status") return "player";
    if (effect.kind === "heal") return "player";
  }
  return "enemy";
}
