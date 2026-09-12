import {
  BattleCardEffectSchema,
  getCardKeywords,
  type BattleCard,
  type BattleCardEffect,
  type DamageType,
  type KeywordId,
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
import { capitalizeWord } from "@/lib/utils";
import {
  getCorruptionTargetEffect,
  applyNumericCorruption,
  getEditableCorruptionTargets,
  type CorruptionTarget,
} from "./numeric";

interface Mutation {
  card: BattleCard;
  delta: 1 | -1;
}

export interface CorruptionMutationGroup {
  kind: keyof typeof CORRUPTION_OUTCOME_WEIGHTS;
  weight: number;
  mutations: Mutation[];
}

const trailingKeywords = new Set(["Consume", "Archery", "Leech", "Companion"]);

function addLine(card: BattleCard, line: string, effect?: BattleCardEffect, first = false): BattleCard {
  const keywordIndex =
    line === "Consume" ? -1 : card.descriptionLines.findIndex((entry) => trailingKeywords.has(entry));
  const lineIndex = first ? 0 : keywordIndex < 0 ? card.descriptionLines.length : keywordIndex;
  const descriptionLines = [...card.descriptionLines];
  descriptionLines.splice(lineIndex, 0, line);
  const positions = (card.corruptedValuePositions ?? []).map((pos) => ({
    ...pos,
    lineIndex: pos.lineIndex >= lineIndex ? pos.lineIndex + 1 : pos.lineIndex,
  }));
  for (const match of line.matchAll(/\d+/g)) positions.push({ lineIndex, matchIndex: match.index });
  return {
    ...card,
    corrupted: true,
    descriptionLines,
    effects: effect ? (first ? [effect, ...card.effects] : [...card.effects, effect]) : [...card.effects],
    corruptedValuePositions: positions,
  };
}

function isPlainMagnitude(effect: BattleCardEffect): boolean {
  if (effect.kind === "heal") return true;
  if (effect.kind === "player-status") {
    return effect.status === "block" && effect.perManaCrystal === undefined && effect.convertCurrentMana === undefined;
  }
  return (
    effect.kind === "damage" &&
    !effect.equalToBlock &&
    !effect.equalToArmor &&
    !effect.equalToForge &&
    effect.equalToGoldPercent === undefined &&
    !effect.doubleIfEnemyBurning &&
    !effect.doubleIfEnemyBleeding &&
    !effect.tripleIfEnemyNotBurning &&
    !effect.detonateIfEnemyBurning &&
    !effect.damageTypePool
  );
}

function numericMutations(card: BattleCard, targets: CorruptionTarget[], strengthen: boolean): Mutation[] {
  return targets.flatMap((target) => {
    const effect = getCorruptionTargetEffect(card, target)!;
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
    return next === card ? [] : [{ card: next, delta: direction }];
  });
}

function plainTarget(card: BattleCard, targets: CorruptionTarget[]): CorruptionTarget | undefined {
  if (card.effects.length !== 1 || !isPlainMagnitude(card.effects[0]!)) return undefined;
  return targets.find((target) => target.field === "amount" && target.value > 0);
}

function conversionMutations(card: BattleCard, target: CorruptionTarget | undefined): BattleCard[] {
  const effect = card.effects[0];
  if (!target || effect?.kind !== "damage") return [];
  const oldLine = `Deal ${effect.amount} ${capitalizeWord(effect.damageType)} damage`;
  if (card.descriptionLines[target.lineIndex] !== oldLine) return [];
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
      const next = applyNumericCorruption(card, target, amount - target.value);
      const descriptionLines = [...next.descriptionLines];
      descriptionLines[target.lineIndex] = `Deal ${amount} ${capitalizeWord(damageType)} damage`;
      return {
        ...next,
        corrupted: true,
        descriptionLines,
        effects: [{ ...effect, damageType, amount }],
        corruptedValuePositions: [
          ...(next.corruptedValuePositions ?? []).filter(
            (position) => position.lineIndex !== target.lineIndex || position.matchIndex !== target.matchIndex,
          ),
          { lineIndex: target.lineIndex, matchIndex: target.matchIndex },
        ],
      };
    });
}

function canRemoveConsume(card: BattleCard): boolean {
  if (!card.consume || card.effects.length !== 1) return false;
  const effect = card.effects[0]!;
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

function removeConsume(card: BattleCard): BattleCard {
  return {
    ...card,
    corrupted: true,
    consume: false,
    ...(card.tags ? { tags: card.tags.filter((tag) => tag !== "consume") } : {}),
    descriptionLines: card.descriptionLines.filter((line) => line !== "Consume"),
    corruptedValuePositions: [],
  };
}

function secondaryKeyword(effect: BattleCardEffect): KeywordId | null {
  if (effect.kind === "player-status" && effect.status === "block") return "block";
  if (effect.kind === "heal") return "health";
  if (effect.kind === "damage" && (effect.damageType === "poison" || effect.damageType === "burn")) {
    return effect.damageType;
  }
  return null;
}

function filterEchoSecondary(cards: BattleCard[], keywords: ReadonlySet<KeywordId>): BattleCard[] {
  const matching = cards.filter((next) => {
    const added = next.effects[next.effects.length - 1];
    if (!added) return false;
    const keyword = secondaryKeyword(added);
    return keyword !== null && keywords.has(keyword);
  });
  return matching.length > 0 ? matching : cards;
}

function filterEchoConversions(cards: BattleCard[], keywords: ReadonlySet<KeywordId>): BattleCard[] {
  const matching = cards.filter((next) => {
    const effect = next.effects[0];
    return effect?.kind === "damage" && keywords.has(effect.damageType);
  });
  return matching.length > 0 ? matching : cards;
}

export function getCorruptionMutationGroups(
  card: BattleCard,
  modifiers: readonly EncounterRewardTraitId[] = [],
): CorruptionMutationGroup[] {
  const targets = getEditableCorruptionTargets(card);
  const target = plainTarget(card, targets);
  const roomForLine =
    card.descriptionLines.filter((line) => !trailingKeywords.has(line)).length < CORRUPTION_MAX_EFFECT_LINES;
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
    const secondary: Array<{ effect: BattleCardEffect; line: string }> = [
      { effect: { kind: "player-status", status: "block", amount }, line: `Gain ${amount} Block` },
      { effect: { kind: "heal", amount }, line: `Restore ${amount} Health` },
      { effect: { kind: "damage", damageType: "poison", amount: damage }, line: `Deal ${damage} Poison damage` },
      { effect: { kind: "damage", damageType: "burn", amount: damage }, line: `Deal ${damage} Burn damage` },
    ];
    add(
      "secondary",
      secondary
        .filter(
          ({ effect }) =>
            !card.effects.some(
              (existing) =>
                existing.kind === effect.kind &&
                (effect.kind !== "damage" || existing.kind !== "damage" || existing.damageType === effect.damageType) &&
                (effect.kind !== "player-status" ||
                  existing.kind !== "player-status" ||
                  existing.status === effect.status),
            ),
        )
        .map(({ effect, line }) => addLine(card, line, effect)),
    );
  }
  if (target && !card.consume) {
    if (roomForLine) {
      add("bargain", [
        addLine(
          applyNumericCorruption(card, target, target.value),
          `Lose ${CORRUPTION_HEALTH_PRICE} Health`,
          { kind: "lose-health", amount: CORRUPTION_HEALTH_PRICE },
          true,
        ),
      ]);
      const amount = CORRUPTION_JACKPOT_AMOUNT;
      add("draw", [
        addLine(card, amount === 1 ? "Draw a card" : `Draw ${amount} cards`, { kind: "draw-cards", amount }),
      ]);
      add("mana", [addLine(card, `Gain ${amount} Mana`, { kind: "restore-mana", amount })]);
    }
    const effect = card.effects[0]!;
    if (effect.kind === "damage" && !effect.lifesteal && !card.descriptionLines.includes("Leech")) {
      add("leech", [addLine({ ...card, effects: [{ ...effect, lifesteal: true }] }, "Leech")]);
    }
    add("consume", [
      {
        ...addLine(applyNumericCorruption(card, target, target.value * (CORRUPTION_CONSUME_MULTIPLIER - 1)), "Consume"),
        consume: true,
      },
    ]);
  }
  add("convert", conversionMutations(card, target));
  if (canRemoveConsume(card)) add("reusable", [removeConsume(card)]);
  let shaped = groups;
  if (modifiers.includes("steady-sigil")) {
    shaped = shaped.filter((group) => group.kind !== "weaken");
  }
  if (modifiers.includes("blood-rite")) {
    shaped = shaped.map((group) => {
      if (group.kind === "leech") return { ...group, weight: group.weight * 3 };
      if (group.kind === "convert") return { ...group, weight: group.weight * 2 };
      return group;
    });
  }
  if (modifiers.includes("echoing-altar")) {
    const keywords = new Set<KeywordId>(getCardKeywords(card));
    shaped = shaped.map((group) => {
      if (group.kind === "secondary" || group.kind === "convert") {
        const filterFn = group.kind === "secondary" ? filterEchoSecondary : filterEchoConversions;
        const kept = new Set(
          filterFn(
            group.mutations.map(({ card: next }) => next),
            keywords,
          ),
        );
        return { ...group, mutations: group.mutations.filter(({ card: next }) => kept.has(next)) };
      }
      return group;
    });
  }
  return shaped
    .map((group) => ({
      ...group,
      mutations: group.mutations.filter(({ card: next }) =>
        next.effects.every((effect) => BattleCardEffectSchema.safeParse(effect).success),
      ),
    }))
    .filter((group) => group.mutations.length > 0);
}
