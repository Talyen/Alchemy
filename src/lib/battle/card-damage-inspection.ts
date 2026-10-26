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
import {
  describeKnownConditionalDamage,
  describeKnownStatusOptions,
  projectCardDescription,
} from "./card-description-projection";
import { applyPotionMultiplier, cardPotionMultiplier } from "./amount-helpers";
import { scaleGoldReward } from "./resource-state";

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

function withKnownUtilityAmount(
  effect: BattleCardEffect,
  outcome: InspectedPackets | undefined,
): BattleCardEffect | undefined {
  const direct = outcome?.directAmounts;
  if (!direct || direct.kind === "unknown") return;
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
  const alternatives = direct.kind === "exact" ? [direct.amounts] : direct.outcomes;
  const amounts = alternatives.map((entries) =>
    entries.filter((entry) => entry.target === "player" && entry.kind === kind && entry.stat === stat),
  );
  // Random extra grants are not promised. Keep the guaranteed direct amount,
  // including its known modifiers, rather than reverting to the unmodified card.
  return amounts.length && amounts.every((entries) => entries.length === 1)
    ? { ...effect, amount: Math.min(...amounts.map((entries) => entries[0]!.amount)) }
    : undefined;
}

function firstAttack(outcome: InspectedPackets | undefined): BattleCardEffect | undefined {
  if (!outcome || outcome.kind === "unknown") return;
  const alternatives = outcome.kind === "exact" ? [outcome.packets] : outcome.outcomes;
  if (!alternatives.length || alternatives.some((packets) => !packets[0])) return;
  return summarize(alternatives.map((packets) => packets[0]!));
}

/** Adjust known fixed literals inline without replacing scaling or conditional rules. */
export function getBattleCardDescriptionInspection(
  card: BattleCard,
  snapshot: BattleSnapshot,
  side: "player" | "enemy" = "player",
): BattleCard {
  const rules = side === "enemy" && isEnemyAbilityCard(card) ? getEncounterEnemyAbility(card, snapshot) : card;
  const inspected = inspectBattleCardDamage(card, snapshot, side);
  let rebuild = false;
  const statusOptions: Array<{ path: number[]; amounts: ReadonlyMap<string, number> }> = [];
  const conditionalDamage: Array<{
    path: number[];
    amount: number;
    damageType: Extract<BattleCardEffect, { kind: "damage" }>["damageType"];
    condition: "bleeding" | "not-burning";
  }> = [];

  function inlineKnownAmount(effect: BattleCardEffect, path: number[]): BattleCardEffect {
    const view = mapEffectChildren(effect, (child, index) => inlineKnownAmount(child, [...path, index]));
    const key = path.join(".");
    const outcome = inspected.outcomes.get(key);
    if (effect.kind === "damage" && outcome?.magnitudes.size) {
      const amount = outcome.magnitudes.get("amount");
      const actual = firstAttack(outcome);
      if (amount !== undefined && actual?.kind === "damage") {
        const frozenAmount = outcome.magnitudes.get("amountIfTargetFrozen");
        if (effect.damageTypeIfTargetFrozen && frozenAmount !== undefined) {
          if (actual.damageType !== effect.damageType) rebuild = true;
          return {
            ...effect,
            amount,
            damageType: actual.damageType,
            amountIfTargetFrozen: frozenAmount,
            damageTypeIfTargetFrozen: actual.damageType,
          };
        }
        const conditional = outcome.magnitudes.get("conditionalAmount");
        if (conditional !== undefined && !(effect.doubleIfEnemyBleeding && effect.tripleIfEnemyNotBurning)) {
          if (actual.damageType !== effect.damageType) rebuild = true;
          if (conditional !== amount)
            conditionalDamage.push({
              path,
              amount: conditional,
              damageType: actual.damageType,
              condition: effect.doubleIfEnemyBleeding ? "bleeding" : "not-burning",
            });
          return { ...effect, amount, damageType: actual.damageType };
        }
      }
    }
    if (effect.kind !== "damage" && outcome?.magnitudes.size) {
      const amounts = Object.fromEntries(outcome.magnitudes);
      if (
        effect.kind === "random-draw" &&
        (amounts.minAmount !== effect.minAmount || amounts.maxAmount !== effect.maxAmount)
      )
        rebuild = true;
      return { ...view, ...amounts };
    }
    // Draw identities can stop the replay, but cannot change these nominal
    // capacities or the Potion multiplier frozen for this authored execution.
    if (outcome?.kind === "unknown") {
      const potionMult = cardPotionMultiplier(snapshot, card);
      if (effect.kind === "wish" || effect.kind === "draw-cards" || effect.kind === "companion-action")
        return { ...effect, amount: applyPotionMultiplier(effect.amount, potionMult) };
      if (effect.kind === "gain-gold")
        return {
          ...effect,
          amount: scaleGoldReward(applyPotionMultiplier(effect.amount, potionMult), snapshot.gearEffects),
        };
    }
    const utility = withKnownUtilityAmount(effect, outcome);
    if (utility) return utility;
    if (effect.kind === "player-status" && effect.statusPool && outcome?.directAmounts.kind !== "unknown") {
      const direct = outcome?.directAmounts;
      const alternatives =
        direct?.kind === "exact" ? [direct.amounts] : direct?.kind === "alternatives" ? direct.outcomes : [];
      const amounts = new Map<string, number>();
      for (const entries of alternatives) {
        for (const entry of entries) {
          if (
            entry.target === "player" &&
            entry.kind === "status" &&
            effect.statusPool.some((status) => status === entry.stat)
          )
            amounts.set(entry.stat, Math.min(amounts.get(entry.stat) ?? Infinity, entry.amount));
        }
      }
      if (effect.statusPool.every((status) => amounts.has(status))) statusOptions.push({ path, amounts });
      return view;
    }
    if (
      (effect.kind !== "damage" && effect.kind !== "random-damage") ||
      (effect.kind === "damage" &&
        (effect.equalToBlock ||
          effect.equalToArmor ||
          effect.forgeBonusPercent !== undefined ||
          effect.damageTypeIfTargetFrozen ||
          effect.doubleIfEnemyBleeding ||
          effect.tripleIfEnemyNotBurning))
    )
      return view;
    // The first packet is the intended attack. Follow-ups stay owned by their
    // existing status/tooltips, and unknown alternatives retain the authored rule.
    const attack = firstAttack(outcome);
    if (!attack) return view;
    if (effect.kind === "random-damage")
      return attack.kind === "random-damage"
        ? { ...effect, minAmount: attack.minAmount, maxAmount: attack.maxAmount, damageTypePool: attack.damageTypePool }
        : attack.kind === "damage"
          ? { ...effect, minAmount: attack.amount, maxAmount: attack.amount, damageTypePool: [attack.damageType] }
          : view;
    if (attack.kind === "random-damage") {
      rebuild = true;
      return attack;
    }
    if (attack.kind === "damage") {
      const types = attack.damageTypePool;
      if (attack.damageType !== effect.damageType || JSON.stringify(types) !== JSON.stringify(effect.damageTypePool))
        rebuild = true;
      return { ...effect, amount: attack.amount, damageType: attack.damageType, damageTypePool: types };
    }
    return view;
  }
  let result = projectCardDescription(
    rules,
    rules.effects.map((effect, index) => inlineKnownAmount(effect, [index])),
    rebuild,
  );
  for (const option of statusOptions) result = describeKnownStatusOptions(result, option.path, option.amounts);
  for (const conditional of conditionalDamage)
    result = describeKnownConditionalDamage(
      result,
      conditional.path,
      conditional.amount,
      conditional.damageType,
      conditional.condition,
    );
  return result;
}
