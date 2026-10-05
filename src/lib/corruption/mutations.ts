import {
  BattleCardEffectSchema,
  createEffectDescription,
  getCardDescription,
  withCardDescription,
  visitBattleCardEffects,
  type BattleCard,
  type BattleCardEffect,
  type DamageType,
} from "@/lib/game-data";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import {
  CORRUPTION_OUTCOME_WEIGHTS,
  CORRUPTION_STRENGTHEN_RATIO,
  CORRUPTION_WEAKEN_RATIO,
  CORRUPTION_CONSUME_MULTIPLIER,
  CORRUPTION_HEALTH_PRICE,
  CORRUPTION_SECONDARY_AMOUNT,
  CORRUPTION_SECONDARY_STATUS_DAMAGE,
  CORRUPTION_JACKPOT_AMOUNT,
  CORRUPTION_MAX_EFFECT_LINES,
  CORRUPTION_DAMAGE_BASELINES,
} from "@/lib/game-constants";
import { addCorruptionEffect, addCorruptionLine, removeConsume, countCorruptionEffectLines } from "./card-edits";
import { applyAltarModifiers } from "./altar-modifiers";
import type { CorruptionMutationGroup, Mutation } from "./mutation-types";
import {
  getCorruptionTargetEffect,
  applyNumericCorruption,
  getEditableCorruptionTargets,
  type CorruptionTarget,
} from "./numeric";

export type { CorruptionMutationGroup } from "./mutation-types";

function isPlainMagnitude(effect: BattleCardEffect): boolean {
  if (effect.kind === "heal") return true;
  if (effect.kind === "player-status") {
    return effect.status === "block" && effect.perManaCrystal === undefined && effect.convertCurrentMana === undefined;
  }
  return (
    effect.kind === "damage" &&
    !effect.equalToBlock &&
    effect.equalToBlockPercent === undefined &&
    !effect.equalToArmor &&
    !effect.equalToForge &&
    effect.equalToGoldPercent === undefined &&
    !effect.doubleIfEnemyBurning &&
    !effect.doubleIfEnemyBleeding &&
    !effect.doubleIfEnemyNotBurning &&
    !effect.tripleIfEnemyNotBurning &&
    !effect.detonateAllBurn &&
    !effect.detonateAllBleed &&
    !effect.detonateIfEnemyBurning &&
    effect.blockCost === undefined &&
    effect.damageTypeIfTargetHasBlock === undefined &&
    effect.damageTypeIfTargetFrozen === undefined &&
    !effect.damageTypePool
  );
}

function numericMutations(card: BattleCard, targets: CorruptionTarget[], strengthen: boolean): Mutation[] {
  return targets.flatMap((target) => {
    const effect = getCorruptionTargetEffect(card, target);
    if (!effect) return [];
    const harmful = ["lose-health", "self-damage", "lose-mana", "lose-max-mana"].includes(effect.kind);
    const direction = strengthen !== harmful ? 1 : -1;
    const scalable =
      target.field === "amount" &&
      isPlainMagnitude(effect) &&
      (effect.kind !== "damage" || ["physical", "holy", "nature"].includes(effect.damageType));
    const amount = scalable
      ? Math.max(1, Math.round(target.value * (strengthen ? CORRUPTION_STRENGTHEN_RATIO : CORRUPTION_WEAKEN_RATIO)))
      : 1;
    const next = applyNumericCorruption(card, target, direction * amount);
    return next === card ? [] : [{ card: next, delta: strengthen ? 1 : -1 }];
  });
}

function plainTarget(card: BattleCard, targets: CorruptionTarget[]): CorruptionTarget | undefined {
  const first = card.effects[0];
  if (card.effects.length !== 1 || !first || !isPlainMagnitude(first)) return undefined;
  return targets.find((target) => target.field === "amount" && target.value > 0);
}

function conversionMutations(card: BattleCard, target: CorruptionTarget | undefined): BattleCard[] {
  const effect = card.effects[0];
  if (!target || effect?.kind !== "damage") return [];
  const types = Object.keys(CORRUPTION_DAMAGE_BASELINES) as DamageType[];
  return types
    .filter((type) => type !== effect.damageType)
    .map((damageType) => {
      const amount = Math.max(
        1,
        Math.round(
          (effect.amount * CORRUPTION_DAMAGE_BASELINES[damageType]) / CORRUPTION_DAMAGE_BASELINES[effect.damageType],
        ),
      );
      const converted = { ...effect, damageType, amount };
      const description = [...getCardDescription(card)];
      const line = createEffectDescription([converted])[0]!;
      description[target.lineIndex] = {
        ...line,
        parts: line.parts.map((part) => (typeof part === "string" ? part : { ...part, corrupted: true })),
      };
      return withCardDescription(
        {
          ...card,
          corrupted: true,
          effects: [converted],
        },
        description,
      );
    });
}

function canRemoveConsume(card: BattleCard): boolean {
  const effect = card.effects[0];
  if (!card.consume || card.effects.length !== 1 || !effect) return false;
  if (effect.kind === "heal") return effect.amount <= 8;
  if (effect.kind === "player-status") {
    return (
      ["block", "armor", "thorns"].includes(effect.status) &&
      effect.amount <= 2 &&
      effect.perManaCrystal === undefined &&
      effect.convertCurrentMana === undefined
    );
  }
  return (
    effect.kind === "damage" &&
    isPlainMagnitude(effect) &&
    effect.amount <= CORRUPTION_DAMAGE_BASELINES[effect.damageType]
  );
}

function secondaryEffectKey(effect: BattleCardEffect): string {
  if (effect.kind === "damage") return `${effect.kind}:${effect.damageType}`;
  if (effect.kind === "player-status") return `${effect.kind}:${effect.status}`;
  return effect.kind;
}

export function getCorruptionMutationGroups(
  card: BattleCard,
  modifiers: readonly EncounterRewardTraitId[] = [],
): CorruptionMutationGroup[] {
  const targets = getEditableCorruptionTargets(card);
  const target = plainTarget(card, targets);
  const roomForLine = countCorruptionEffectLines(card) < CORRUPTION_MAX_EFFECT_LINES;
  const groups: CorruptionMutationGroup[] = [];
  function add(kind: CorruptionMutationGroup["kind"], cards: BattleCard[]) {
    if (cards.length)
      groups.push({
        kind,
        weight: CORRUPTION_OUTCOME_WEIGHTS[kind],
        mutations: cards.map((next) => ({ card: next, delta: 1 })),
      });
  }
  for (const kind of ["strengthen", "weaken"] as const) {
    const mutations = numericMutations(card, targets, kind === "strengthen");
    if (mutations.length) groups.push({ kind, weight: CORRUPTION_OUTCOME_WEIGHTS[kind], mutations });
  }
  if (roomForLine) {
    const amount = CORRUPTION_SECONDARY_AMOUNT;
    const damage = CORRUPTION_SECONDARY_STATUS_DAMAGE;
    const secondary: BattleCardEffect[] = [
      { kind: "player-status", status: "block", amount },
      { kind: "heal", amount },
      { kind: "damage", damageType: "poison", amount: damage },
      { kind: "damage", damageType: "burn", amount: damage },
    ];
    const existingEffects = new Set<string>();
    visitBattleCardEffects(card.effects, (effect) => {
      existingEffects.add(secondaryEffectKey(effect));
      return false;
    });
    add(
      "secondary",
      secondary
        .filter((effect) => !existingEffects.has(secondaryEffectKey(effect)))
        .map((effect) => addCorruptionEffect(card, effect)),
    );
  }
  if (target && !card.consume) {
    if (roomForLine) {
      add("bargain", [
        addCorruptionEffect(
          applyNumericCorruption(card, target, target.value),
          { kind: "lose-health", amount: CORRUPTION_HEALTH_PRICE },
          "first",
        ),
      ]);
      const amount = CORRUPTION_JACKPOT_AMOUNT;
      add("draw", [addCorruptionEffect(card, { kind: "draw-cards", amount })]);
      add("mana", [addCorruptionEffect(card, { kind: "restore-mana", amount })]);
    }
    const effect = card.effects[0];
    if (effect && effect.kind === "damage" && !effect.lifesteal) {
      add("leech", [addCorruptionLine({ ...card, effects: [{ ...effect, lifesteal: true }] }, "Leech")]);
    }
    add("consume", [
      {
        ...addCorruptionLine(
          applyNumericCorruption(card, target, target.value * (CORRUPTION_CONSUME_MULTIPLIER - 1)),
          "Consume",
          "consume",
        ),
        consume: true,
      },
    ]);
  }
  add("convert", conversionMutations(card, target));
  if (canRemoveConsume(card)) add("reusable", [removeConsume(card)]);
  return applyAltarModifiers(groups, card, modifiers)
    .map((group) => ({
      ...group,
      mutations: group.mutations.filter(({ card: next }) =>
        next.effects.every((effect) => BattleCardEffectSchema.safeParse(effect).success),
      ),
    }))
    .filter((group) => group.mutations.length > 0);
}
