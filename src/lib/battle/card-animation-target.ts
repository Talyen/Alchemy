import { visitBattleCardEffects, type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import { getBattleCardPlayTarget } from "./card-classification";
import { inspectBattleCardOutcomes } from "./card-damage-inspection";
import type { InspectedPackets } from "./inspection-outcomes";
import type { BattleSnapshot } from "./types";

type Target = "player" | "enemy";

function isCost(effect: BattleCardEffect): boolean {
  return ["lose-health", "self-damage", "lose-mana", "lose-max-mana"].includes(effect.kind);
}

function withoutCosts(effects: readonly BattleCardEffect[]): BattleCardEffect[] {
  return effects.flatMap((effect): BattleCardEffect[] => {
    if (isCost(effect)) return [];
    if (effect.kind === "chance" && effect.probability >= 1) return withoutCosts(effect.successEffects);
    if (effect.kind === "chance" && effect.probability <= 0) return withoutCosts(effect.failureEffects);
    if (effect.kind === "chance")
      return [
        {
          ...effect,
          successEffects: withoutCosts(effect.successEffects),
          failureEffects: withoutCosts(effect.failureEffects),
        },
      ];
    if (effect.kind === "repeat-over-turns") return [{ ...effect, effects: withoutCosts(effect.effects) }];
    return [effect];
  });
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
  const magnitudes = alternatives.map((entries) =>
    Math.max(
      0,
      ...entries
        .filter(
          (entry) =>
            // Healing conversions and riders must not outrank the intended heal.
            effect.kind !== "heal" || (entry.kind === "heal" && entry.stat === "health"),
        )
        .map((entry) => entry.amount),
    ),
  );
  return magnitudes.every((amount) => amount === magnitudes[0]) ? magnitudes[0] : undefined;
}

/** Visual recipient only. Compare direct point/count magnitudes, never utility scores or factors. */
export function getBattleCardAnimationTarget(card: BattleCard, snapshot: BattleSnapshot): Target {
  const effects = withoutCosts(card.effects);
  const preferred = getBattleCardPlayTarget(effects.length ? { ...card, effects } : card);
  const targets = new Set<Target>();
  let uncertainBranch = false;
  visitBattleCardEffects(effects, (effect) => {
    if (effect.kind === "chance") uncertainBranch ||= effect.probability > 0 && effect.probability < 1;
    else if (effect.kind !== "repeat-over-turns") targets.add(getBattleCardPlayTarget({ ...card, effects: [effect] }));
  });
  // Most cards have one recipient. Unknown branches never consume live RNG to
  // choose a more attractive animation; retain the authored primary recipient.
  if (targets.size <= 1 || uncertainBranch) return preferred;

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
    const recipient: Target = kind === "attack" ? "enemy" : getBattleCardPlayTarget({ ...card, effects: [effect] });
    if (Number.isFinite(amount) && (amount > largest || (amount === largest && recipient === preferred))) {
      largest = amount;
      target = recipient;
    }
  }
  card.effects.forEach((effect, index) => rank(effect, [index]));
  return unknown ? preferred : target;
}
