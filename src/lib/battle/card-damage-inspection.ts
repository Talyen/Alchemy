import {
  getCardDescription,
  getCardEffect,
  mapEffectChildren,
  isEnemyAbilityCard,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { resolveInspectedCardPlay } from "./card-play";
import { battleSnapshot } from "./battle-snapshot";
import { applyEnemyAbility } from "./enemy-turn-attack";
import { getEncounterEnemyAbility } from "./enemy-description";
import { inspectResolutionOutcomes, type InspectedPackets } from "./inspection-outcomes";
import type { BattleSnapshot } from "./types";

/** Resolve production rules against detached, correlated alternatives. */
export function inspectBattleCardDamage(
  card: BattleCard,
  snapshot: BattleSnapshot,
  side: "player" | "enemy" = "player",
): ReadonlyMap<string, InspectedPackets> {
  const sourceAddresses = new Map<BattleCardEffect, string>();
  function copyEffect(effect: BattleCardEffect, path: number[]): BattleCardEffect {
    // One identity per occurrence, even if authored arrays share effect objects.
    const copy = mapEffectChildren({ ...effect }, (child, index) => copyEffect(child, [...path, index]));
    sourceAddresses.set(copy, path.join("."));
    return copy;
  }
  const resolutionCard = { ...card, effects: card.effects.map((effect, index) => copyEffect(effect, [index])) };
  const baseState = battleSnapshot(snapshot);
  const enemyAbility = side === "enemy" && isEnemyAbilityCard(resolutionCard);
  const handIndex = enemyAbility ? -1 : snapshot.hand.indexOf(card);
  const resolved = inspectResolutionOutcomes(resolutionCard, (rng, observer) => {
    // Only admission is hypothetical. Production owns payment and every consequence.
    const state = {
      ...baseState,
      rng,
      observer,
      sampleWishOptions: () => ({ cards: [], deferred: true }),
    };
    if (enemyAbility) applyEnemyAbility(state, resolutionCard, []);
    else resolveInspectedCardPlay(state, resolutionCard, handIndex);
  });
  const outcomes = new Map<string, InspectedPackets>();
  for (const [effect, result] of resolved) outcomes.set(sourceAddresses.get(effect)!, result);
  return outcomes;
}

/** Adjust fixed attack literals in-place without replacing scaling or conditional rules. */
export function getBattleCardDescriptionInspection(
  card: BattleCard,
  snapshot: BattleSnapshot,
  side: "player" | "enemy" = "player",
): BattleCard {
  const rules = side === "enemy" && isEnemyAbilityCard(card) ? getEncounterEnemyAbility(card, snapshot) : card;
  const inspected = inspectBattleCardDamage(card, snapshot, side);
  function inlineKnownAmount(
    effect: BattleCardEffect,
    path: number[],
    skipPaths?: ReadonlySet<string>,
  ): BattleCardEffect {
    const view = mapEffectChildren(effect, (child, index) => inlineKnownAmount(child, [...path, index], skipPaths));
    const key = path.join(".");
    if (
      skipPaths?.has(key) ||
      effect.kind !== "damage" ||
      effect.equalToBlock ||
      effect.equalToArmor ||
      effect.forgeBonusPercent !== undefined ||
      effect.damageTypeIfTargetFrozen ||
      effect.doubleIfEnemyBleeding ||
      effect.tripleIfEnemyNotBurning ||
      effect.damageTypePool
    )
      return view;
    const outcome = inspected.get(key);
    // The first packet is the intended attack. Follow-ups stay owned by their
    // existing status/tooltips, and unknown alternatives retain the authored rule.
    const attack = outcome?.kind === "exact" ? outcome.packets[0] : undefined;
    return attack?.kind === "damage" && attack.damageType === effect.damageType
      ? { ...effect, amount: attack.amount }
      : view;
  }
  const description = getCardDescription(rules);
  const candidateEffects = rules.effects.map((effect, index) => inlineKnownAmount(effect, [index]));
  // Shared magnitudes ("... twice", "... this turn and next", "Deal and Receive ...")
  // bind multiple effect fields to one displayed literal; inline only when every
  // referenced field still agrees on the same value.
  const inconsistentPaths = new Set<string>();
  for (const part of description.flatMap((line) => line.parts)) {
    if (typeof part === "string" || part.references.length < 2) continue;
    const values = part.references.map((reference) => {
      const effect = getCardEffect(candidateEffects, reference);
      const fieldValue =
        effect && effect.kind === reference.kind ? (effect as Record<string, unknown>)[reference.field] : undefined;
      return typeof fieldValue === "number" ? fieldValue / (reference.multiplier ?? 1) : NaN;
    });
    if (values.some((value) => value !== values[0])) {
      for (const reference of part.references)
        inconsistentPaths.add([reference.effectIndex, ...(reference.effectPath ?? [])].join("."));
    }
  }
  const effects = inconsistentPaths.size
    ? rules.effects.map((effect, index) => inlineKnownAmount(effect, [index], inconsistentPaths))
    : candidateEffects;
  return withCardDescription({ ...rules, effects }, description);
}
