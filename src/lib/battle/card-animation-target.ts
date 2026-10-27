import { visitBattleCardEffects, type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import { effectTarget, getBattleCardPlayTarget } from "./card-classification";
import { inspectBattleCardOutcomes } from "./card-damage-inspection";
import type { InspectedPackets } from "./inspection-outcomes";
import type { BattleSnapshot } from "./types";

type Target = "player" | "enemy";

function isCost(effect: BattleCardEffect): boolean {
  return (
    effect.kind === "lose-health" ||
    effect.kind === "self-damage" ||
    effect.kind === "lose-mana" ||
    effect.kind === "lose-max-mana"
  );
}

// Effect trees are immutable; the projection stays private and follows their lifetime.
const costFreeEffects = new WeakMap<readonly BattleCardEffect[], BattleCardEffect[]>();

function withoutCosts(effects: readonly BattleCardEffect[]): BattleCardEffect[] {
  const cached = costFreeEffects.get(effects);
  if (cached) return cached;
  const result: BattleCardEffect[] = [];
  for (const effect of effects) {
    if (isCost(effect)) continue;
    if (effect.kind === "chance" && effect.probability >= 1) result.push(...withoutCosts(effect.successEffects));
    else if (effect.kind === "chance" && effect.probability <= 0) result.push(...withoutCosts(effect.failureEffects));
    else if (effect.kind === "chance")
      result.push({
        ...effect,
        successEffects: withoutCosts(effect.successEffects),
        failureEffects: withoutCosts(effect.failureEffects),
      });
    else if (effect.kind === "repeat-over-turns") result.push({ ...effect, effects: withoutCosts(effect.effects) });
    else result.push(effect);
  }
  costFreeEffects.set(effects, result);
  return result;
}

function numericKind(effect: BattleCardEffect): "attack" | "utility" | null {
  switch (effect.kind) {
    case "damage":
    case "random-damage":
    case "cleanse-player-status-to-damage":
      return "attack";
    case "player-status":
      // Haste and Phoenix Feather encode duration/charges, not combat points.
      return effect.status === "haste" || effect.status === "phoenixFeather" ? null : "utility";
    case "heal":
    case "restore-mana":
    case "gain-max-mana":
    case "gain-gold":
    case "draw-cards":
    case "random-draw":
    case "remove-enemy-armor":
    case "multiply-enemy-status":
      return "utility";
    case "chance":
    case "repeat-over-turns":
    case "companion-action":
    case "summon-companion":
    case "dodge-next-attack":
    case "lose-health":
    case "lose-mana":
    case "lose-max-mana":
    case "self-damage":
    case "next-archery-free":
    case "next-hit-crit":
    case "next-hit-leech":
    case "next-hit-poison":
    case "play-next-card-twice":
    case "remove-harmful-status":
    case "remove-player-status":
    case "wish":
      return null;
  }
}

function knownAttackAmount(outcome: InspectedPackets | undefined): number | undefined {
  if (!outcome || outcome.kind === "unknown") return undefined;
  const alternatives = outcome.kind === "exact" ? [outcome.packets] : outcome.outcomes;
  // Follow-up packets are procs, not another authored effect of this card.
  const first = alternatives[0]?.[0]?.amount ?? 0;
  return alternatives.every((packets) => (packets[0]?.amount ?? 0) === first) ? first : undefined;
}

function knownUtilityAmount(effect: BattleCardEffect, outcome: InspectedPackets | undefined): number | undefined {
  const observed = outcome?.directAmounts;
  if (!observed || observed.kind === "unknown") return undefined;
  const alternatives = observed.kind === "exact" ? [observed.amounts] : observed.outcomes;
  let first: number | undefined;
  for (const entries of alternatives) {
    let magnitude = 0;
    for (const entry of entries) {
      // Healing conversions and riders must not outrank the intended heal.
      if (effect.kind !== "heal" || (entry.kind === "heal" && entry.stat === "health"))
        magnitude = Math.max(magnitude, entry.amount);
    }
    if (Number.isNaN(magnitude)) return undefined;
    if (first === undefined) first = magnitude;
    else if (magnitude !== first) return undefined;
  }
  return first;
}

/** Visual recipient only. Compare direct point/count magnitudes, never utility scores or factors. */
export function getBattleCardAnimationTarget(card: BattleCard, snapshot: BattleSnapshot): Target {
  const effects = withoutCosts(card.effects);
  const preferred = getBattleCardPlayTarget(effects.length ? { ...card, effects } : card);
  let playerTarget = false;
  let enemyTarget = false;
  let uncertainBranch = false;
  visitBattleCardEffects(effects, (effect) => {
    if (effect.kind === "chance") uncertainBranch ||= effect.probability > 0 && effect.probability < 1;
    else if (effect.kind !== "repeat-over-turns") {
      if (effectTarget(effect) === "player") playerTarget = true;
      else enemyTarget = true;
    }
  });
  // Most cards have one recipient. Unknown branches never consume live RNG to
  // choose a more attractive animation; retain the authored primary recipient.
  if (!playerTarget || !enemyTarget || uncertainBranch) return preferred;

  const outcomes = inspectBattleCardOutcomes(card, snapshot);
  let target = preferred;
  let largest = 0;
  let unknown = false;
  function rank(effect: BattleCardEffect, path: number[]): void {
    if (effect.kind === "repeat-over-turns") return;
    if (effect.kind === "chance") {
      const chosen = effect.probability >= 1 ? effect.successEffects : effect.failureEffects;
      const offset = effect.probability >= 1 ? 0 : effect.successEffects.length;
      chosen.forEach((nested, index) => rank(nested, [...path, offset + index]));
      return;
    }
    const kind = numericKind(effect);
    if (!kind) return;
    const outcome = outcomes.get(path.join("."));
    const amount = kind === "attack" ? knownAttackAmount(outcome) : knownUtilityAmount(effect, outcome);
    if (amount === undefined) {
      unknown = true;
      return;
    }
    const recipient: Target = kind === "attack" ? "enemy" : (effectTarget(effect) ?? "enemy");
    if (Number.isFinite(amount) && (amount > largest || (amount === largest && recipient === preferred))) {
      largest = amount;
      target = recipient;
    }
  }
  card.effects.forEach((effect, index) => rank(effect, [index]));
  return unknown ? preferred : target;
}
