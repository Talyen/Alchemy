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
import type { ObservedAttack, ObservedDirectAmount } from "./resolution-observer";
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

/** Resolve production rules against detached alternatives, retaining each effect's authored address. */
export function inspectCardEffectOutcomes(
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

/** Resolve production rules against detached alternatives, then adapt observations to description lines. */
export function inspectBattleCardDamage(
  card: BattleCard,
  snapshot: BattleSnapshot,
  side: "player" | "enemy" = "player",
): BattleDamageInspection {
  const presentation = side === "enemy" && isEnemyAbilityCard(card) ? getEncounterEnemyAbility(card, snapshot) : card;
  const outcomes = inspectCardEffectOutcomes(card, snapshot, side);
  function project(effect: BattleCardEffect, path: number[]): BattleCardEffect[] {
    if (
      effect.kind !== "damage" &&
      effect.kind !== "random-damage" &&
      effect.kind !== "cleanse-player-status-to-damage"
    )
      return [effect];
    const inspected = outcomes.get(path.join("."));
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
      const projected = project(effect, sourcePath);
      if (effect.kind === "cleanse-player-status-to-damage" && projected.length > 1)
        projectedAddresses.set(sourcePath.join("."), address([...targetPath.slice(0, -1), targetPath.at(-1)! + 1]));
      results.push(...(projected.length === 1 && projected[0] === effect ? [view] : projected));
    });
    return results;
  };
  const effects = projectTree(card.effects, presentation.effects);
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

function withKnownUtilityAmount(
  effect: BattleCardEffect,
  outcome: InspectedPackets | undefined,
): BattleCardEffect | undefined {
  const direct = outcome?.directAmounts;
  if (direct?.kind !== "exact") return;
  let stat: ObservedDirectAmount["stat"];
  let kind: ObservedDirectAmount["kind"] = "status";
  if (effect.kind === "player-status") {
    // These numbers describe a formula, random choice, duration or charge,
    // rather than the fixed point grant that the observer reports.
    if (
      effect.perManaCrystal !== undefined ||
      effect.convertCurrentMana !== undefined ||
      effect.statusPool?.length ||
      effect.status === "haste" ||
      effect.status === "phoenixFeather"
    )
      return;
    stat = effect.status;
  } else if (effect.kind === "heal") {
    stat = "health";
    kind = "heal";
  } else if (effect.kind === "restore-mana" || effect.kind === "gain-max-mana") stat = "mana";
  else if (effect.kind === "gain-gold") stat = "gold";
  else return;
  // Match this authored effect's own result, never a total of other resources,
  // overheal conversions, existing stacks or separately triggered rewards.
  const matching = direct.amounts.filter(
    (entry) => entry.target === "player" && entry.kind === kind && entry.stat === stat,
  );
  return matching.length === 1 ? { ...effect, amount: matching[0]!.amount } : undefined;
}

/** Adjust known fixed literals inline without replacing scaling or conditional rules. */
export function getBattleCardDescriptionInspection(
  card: BattleCard,
  snapshot: BattleSnapshot,
  side: "player" | "enemy" = "player",
): BattleCard {
  const rules = side === "enemy" && isEnemyAbilityCard(card) ? getEncounterEnemyAbility(card, snapshot) : card;
  const outcomes = inspectCardEffectOutcomes(card, snapshot, side);
  function inlineKnownAmount(
    effect: BattleCardEffect,
    path: number[],
    skipPaths?: ReadonlySet<string>,
  ): BattleCardEffect {
    const view = mapEffectChildren(effect, (child, index) => inlineKnownAmount(child, [...path, index], skipPaths));
    const key = path.join(".");
    if (skipPaths?.has(key)) return view;
    const outcome = outcomes.get(key);
    const utility = withKnownUtilityAmount(effect, outcome);
    if (utility) return utility;
    if (
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
