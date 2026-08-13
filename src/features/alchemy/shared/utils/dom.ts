// DOM helpers for card rect capture, tilt effects, and card play target inference.
// Depends on React mouse events, battle card shapes, and alchemy geometry types.
// Used by card UI and ghost animation code where viewport coordinates matter.
import type { MouseEvent } from "react";
import type { BattleCard } from "@/lib/game-data";
import type { CardRect } from "../types";

interface TiltFrame {
  clientX: number;
  clientY: number;
  rafId: number | null;
}

const tiltFrames = new WeakMap<HTMLElement, TiltFrame>();

export const DEFAULT_TILT_STRENGTH = 15;

export function getCardRect(element: DOMRect): CardRect {
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}

export function setTiltFromEvent(event: MouseEvent<HTMLElement>) {
  // Tilt updates are batched through requestAnimationFrame so rapid mousemove events do
  // not write CSS variables more often than the browser can paint.
  const target = event.currentTarget;
  const frame = tiltFrames.get(target) ?? { clientX: event.clientX, clientY: event.clientY, rafId: null };
  frame.clientX = event.clientX;
  frame.clientY = event.clientY;
  tiltFrames.set(target, frame);
  target.classList.add("tilt-active");

  if (frame.rafId !== null) return;

  // Batch tilt writes into the next animation frame so hover movement never forces
  // layout and style work multiple times in the same frame.
  frame.rafId = requestAnimationFrame(() => {
    const latest = tiltFrames.get(target);
    if (!latest) return;
    const rect = target.getBoundingClientRect();
    const x = rect.width === 0 ? 0.5 : (latest.clientX - rect.left) / rect.width;
    const y = rect.height === 0 ? 0.5 : (latest.clientY - rect.top) / rect.height;
    const strength = Number(target.dataset.tiltStrength ?? DEFAULT_TILT_STRENGTH);
    target.style.setProperty("--tilt-rotate-y", `${(x - 0.5) * strength}deg`);
    target.style.setProperty("--tilt-rotate-x", `${(0.5 - y) * strength}deg`);
    latest.rafId = null;
  });
}

function clearTiltElement(target: HTMLElement) {
  const frame = tiltFrames.get(target);
  if (frame?.rafId !== null && frame?.rafId !== undefined) cancelAnimationFrame(frame.rafId);
  tiltFrames.delete(target);
  target.classList.remove("tilt-active");
  target.style.setProperty("--tilt-rotate-y", "0deg");
  target.style.setProperty("--tilt-rotate-x", "0deg");
}

export function clearTiltFromEvent(event: MouseEvent<HTMLElement>) {
  clearTiltElement(event.currentTarget);
}

export function getBattleCardPlayTarget(card: BattleCard): "player" | "enemy" {
  for (const effect of card.effects) {
    if (effect.kind === "damage") return "enemy";
    if (effect.kind === "player-status") return "player";
    if (effect.kind === "heal") return "player";
    if (effect.kind === "summon-companion") return "player";
  }
  return "enemy";
}
