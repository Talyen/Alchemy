import type { MouseEvent } from "react";

import type { BattleState, CombatTextEvent } from "@/lib/battle";
import { keywordDefinitions, type BattleCard, type EnemyStatusId, type KeywordId, type PlayerStatusId } from "@/lib/game-data";

import { combatTextColorClasses, combatTextIconClasses, keywordAliases, keywordIcons, keywordPattern } from "./config";
import type { CardRect, DescriptionPart, StatusChip } from "./types";

export function tokenizeDescription(line: string) {
  const pieces: DescriptionPart[] = [];
  let lastIndex = 0;
  const matches = line.matchAll(keywordPattern);

  for (const match of matches) {
    const matchedText = match[0];
    const matchIndex = match.index ?? 0;
    const keywordId = keywordAliases.find((alias) => alias.match.toLowerCase() === matchedText.toLowerCase())?.keywordId;

    if (matchIndex > lastIndex) {
      pieces.push({ text: line.slice(lastIndex, matchIndex) });
    }

    if (keywordId) {
      pieces.push({ text: matchedText, keywordId });
    } else {
      pieces.push({ text: matchedText });
    }

    lastIndex = matchIndex + matchedText.length;
  }

  if (lastIndex < line.length) {
    pieces.push({ text: line.slice(lastIndex) });
  }

  return pieces.length > 0 ? pieces : [{ text: line }];
}

export function getHoverId(scope: string, id: string) {
  return `${scope}:${id}`;
}

export function sampleItems<T>(items: readonly T[], count: number) {
  const pool = [...items];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  return pool.slice(0, Math.min(count, pool.length));
}

export function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function appendUnique(values: string[], nextValue: string) {
  return values.includes(nextValue) ? values : [...values, nextValue];
}

export function getPlayerStatusChips(state: BattleState): StatusChip[] {
  const order: PlayerStatusId[] = ["block", "armor", "forge", "haste", "burn", "poison", "bleed", "freeze", "stun"];

  return order
    .map((statusId) => ({ id: statusId as KeywordId, value: state.playerStatuses[statusId] }))
    .filter((status) => status.value > 0);
}

export function getEnemyStatusChips(state: BattleState): StatusChip[] {
  const order: EnemyStatusId[] = ["burn", "poison", "bleed", "freeze", "stun"];

  return order
    .map((statusId) => ({ id: statusId as KeywordId, value: state.enemyStatuses[statusId] }))
    .filter((status) => status.value > 0);
}

export function getCombatTextColorClass(event: CombatTextEvent) {
  if (event.kind === "damage" && event.stat === "health") {
    return "text-red-400";
  }
  if (event.kind === "heal") {
    return combatTextColorClasses.health;
  }

  return combatTextColorClasses[event.stat] ?? "text-slate-100";
}

export function getCombatTextIcon(event: CombatTextEvent) {
  if (event.kind === "damage" && event.stat === "health") {
    return combatTextIconClasses.physical;
  }

  return combatTextIconClasses[event.stat] ?? keywordIcons[event.stat as KeywordId] ?? keywordIcons.health;
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

export function getCardRect(input: DOMRect): CardRect {
  return {
    x: input.left,
    y: input.top,
    width: input.width,
    height: input.height,
  };
}

export function getBattleCardPlayTarget(card: BattleCard): "player" | "enemy" | "center" {
  if (card.effects.some((effect) => effect.kind === "damage")) {
    return "enemy";
  }

  if (card.effects.some((effect) => effect.kind === "player-status" || effect.kind === "heal" || effect.kind === "remove-ailment")) {
    return "player";
  }

  return "center";
}
