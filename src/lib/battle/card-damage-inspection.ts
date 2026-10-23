import {
  carryCardDescriptionMarks,
  getCardDescription,
  getCardEffect,
  mapEffectChildren,
  mapCardDescriptionReferences,
  isEnemyAbilityCard,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
  type CardEffectAddress,
  type CardMagnitudeReference,
} from "@/lib/game-data";
import { resolveInspectedCardPlay } from "./card-play";
import { battleSnapshot } from "./battle-snapshot";
import { applyEnemyAbility } from "./enemy-turn-attack";
import { getEncounterEnemyAbility } from "./enemy-description";
import { inspectResolutionOutcomes, type InspectedPackets } from "./inspection-outcomes";
import type { ObservedAttack } from "./resolution-observer";
import type { BattleSnapshot } from "./types";

type DamageEffect = ObservedAttack;

export interface BattleDamageInspection {
  card: BattleCard;
  outcomes: ReadonlyMap<string, InspectedPackets>;
}

function summarize(packets: readonly DamageEffect[]): BattleCardEffect {
  const first = packets[0]!;
  if (packets.length === 1 && !Number.isNaN(first.amount)) return { ...first };
  const damageTypes = new Set<DamageEffect["damageType"]>();
  let minAmount = Infinity;
  let maxAmount = -Infinity;
  let sameAmount = true;
  for (const packet of packets) {
    damageTypes.add(packet.damageType);
    minAmount = Math.min(minAmount, packet.amount);
    maxAmount = Math.max(maxAmount, packet.amount);
    if (packet.amount !== first.amount) sameAmount = false;
  }
  const types = [...damageTypes];
  if (sameAmount) return { ...first, ...(types.length > 1 ? { damageTypePool: types } : {}) };
  return {
    kind: "random-damage",
    minAmount,
    maxAmount,
    damageTypePool: types,
    ...(first.lifesteal ? { lifesteal: true } : {}),
  };
}

/** Resolve production rules against detached alternatives, then adapt observations to description lines. */
export function inspectBattleCardDamage(
  card: BattleCard,
  snapshot: BattleSnapshot,
  side: "player" | "enemy" = "player",
): BattleDamageInspection {
  const presentation = side === "enemy" && isEnemyAbilityCard(card) ? getEncounterEnemyAbility(card, snapshot) : card;
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
  function project(effect: BattleCardEffect): BattleCardEffect[] {
    if (
      effect.kind !== "damage" &&
      effect.kind !== "random-damage" &&
      effect.kind !== "cleanse-player-status-to-damage"
    )
      return [effect];
    const inspected = resolved.get(effect);
    if (!inspected || inspected.kind === "unknown") return [effect];
    const alternatives = inspected.kind === "exact" ? [inspected.packets] : inspected.outcomes;
    const zero: DamageEffect = {
      kind: "damage",
      damageType: effect.kind === "random-damage" ? (effect.damageTypePool?.[0] ?? "physical") : effect.damageType,
      amount: 0,
    };
    let count = 1;
    for (const packets of alternatives) count = Math.max(count, packets.length);
    const results = Array.from({ length: count }, (_, index) =>
      summarize(alternatives.map((packets) => packets[index] ?? zero)),
    );
    return effect.kind === "cleanse-player-status-to-damage"
      ? [{ kind: "remove-player-status", status: effect.status }, ...results]
      : results;
  }
  const projectedAddresses = new Map<string, CardEffectAddress>();
  const address = (path: number[]): CardEffectAddress => ({
    effectIndex: path[0]!,
    ...(path.length > 1 ? { effectPath: path.slice(1) } : {}),
  });
  // This traversal maps description addresses only. It never resolves effects.
  const projectTree = (
    effects: readonly BattleCardEffect[],
    displayed: readonly BattleCardEffect[],
    sourcePrefix: number[] = [],
    targetPrefix: number[] = [],
    sourceOffset = 0,
    targetOffset = 0,
  ): BattleCardEffect[] => {
    const results: BattleCardEffect[] = [];
    effects.forEach((effect, index) => {
      const view = displayed[index] ?? effect;
      const sourcePath = [...sourcePrefix, index + sourceOffset];
      const targetPath = [...targetPrefix, results.length + targetOffset];
      projectedAddresses.set(sourcePath.join("."), address(targetPath));
      if (effect.kind === "chance" && view.kind === "chance") {
        const successEffects = projectTree(effect.successEffects, view.successEffects, sourcePath, targetPath);
        const failureEffects = projectTree(
          effect.failureEffects,
          view.failureEffects,
          sourcePath,
          targetPath,
          effect.successEffects.length,
          successEffects.length,
        );
        results.push({ ...view, successEffects, failureEffects });
        return;
      }
      const projected = project(effect);
      if (effect.kind === "cleanse-player-status-to-damage" && projected.length > 1)
        projectedAddresses.set(sourcePath.join("."), address([...targetPath.slice(0, -1), targetPath.at(-1)! + 1]));
      results.push(...(projected.length === 1 && projected[0] === effect ? [view] : projected));
    });
    return results;
  };
  const effects = projectTree(resolutionCard.effects, presentation.effects);
  // No offensive packets: preserve custom utility and summon descriptions verbatim.
  if (!effects.some((effect) => ["damage", "random-damage", "chance"].includes(effect.kind)))
    return { card: presentation, outcomes };
  const { description: _description, ...base } = presentation;
  const projected = { ...base, effects };
  // Added follow-up lines must not steal a later effect's Corruption marks.
  const previous = getCardDescription(card).map((line) => ({
    ...line,
    parts: line.parts.map((part) =>
      typeof part === "string"
        ? part
        : {
            ...part,
            references: part.references.flatMap((reference): CardMagnitudeReference[] => {
              const location = projectedAddresses.get(
                [reference.effectIndex, ...(reference.effectPath ?? [])].join("."),
              );
              if (!location) return [reference];
              const target = getCardEffect(effects, location);
              // A computed range has two distinct magnitude IDs. Both inherit the
              // authored amount's marks without sharing a now-invalid amount binding.
              if (reference.kind === "damage" && reference.field === "amount" && target?.kind === "random-damage")
                return (["minAmount", "maxAmount"] as const).map((field) => ({
                  ...reference,
                  ...location,
                  kind: "random-damage",
                  field,
                }));
              if (reference.kind === "random-damage" && target?.kind === "damage")
                return [{ ...reference, ...location, kind: "damage", field: "amount" }];
              return [{ ...reference, ...location }];
            }),
          },
    ),
  }));
  const description = carryCardDescriptionMarks(
    previous,
    mapCardDescriptionReferences(getCardDescription(projected), (reference) => reference, "inspection"),
  );
  return { card: withCardDescription(projected, description), outcomes };
}

/** Presentation copies only; never execute their adjusted damage effects. */
export function getBattleDamageInspectionCard(
  card: BattleCard,
  snapshot: BattleSnapshot,
  side: "player" | "enemy" = "player",
): BattleCard {
  return inspectBattleCardDamage(card, snapshot, side).card;
}
