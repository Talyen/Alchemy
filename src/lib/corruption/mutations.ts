import {
  BattleCardEffectSchema,
  effectDescriptionLine,
  getCardKeywords,
  visitBattleCardEffects,
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

function addEffect(card: BattleCard, effect: BattleCardEffect, first = false): BattleCard {
  return addLine(card, effectDescriptionLine(effect), effect, first);
}

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
  const oldLine = effectDescriptionLine(effect);
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
      const converted = { ...effect, damageType, amount };
      const descriptionLines = [...card.descriptionLines];
      descriptionLines[target.lineIndex] = effectDescriptionLine(converted);
      return {
        ...card,
        corrupted: true,
        descriptionLines,
        effects: [converted],
        corruptedValuePositions: [
          ...(card.corruptedValuePositions ?? []).filter(
            (position) => position.lineIndex !== target.lineIndex || position.matchIndex !== target.matchIndex,
          ),
          { lineIndex: target.lineIndex, matchIndex: target.matchIndex },
        ],
      };
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

function removeConsume(card: BattleCard): BattleCard {
  const consumeIndex = card.descriptionLines.indexOf("Consume");
  const positions =
    consumeIndex < 0
      ? (card.corruptedValuePositions ?? [])
      : (card.corruptedValuePositions ?? [])
          .filter((pos) => pos.lineIndex !== consumeIndex)
          .map((pos) => (pos.lineIndex > consumeIndex ? { ...pos, lineIndex: pos.lineIndex - 1 } : pos));
  return {
    ...card,
    corrupted: true,
    consume: false,
    ...(card.tags ? { tags: card.tags.filter((tag) => tag !== "consume") } : {}),
    descriptionLines: card.descriptionLines.filter((line) => line !== "Consume"),
    corruptedValuePositions: positions,
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

function filterEchoSecondary(mutations: Mutation[], keywords: ReadonlySet<KeywordId>): Mutation[] {
  const matching = mutations.filter(({ card }) => {
    const added = card.effects.at(-1);
    if (!added) return false;
    const keyword = secondaryKeyword(added);
    return keyword !== null && keywords.has(keyword);
  });
  return matching.length > 0 ? matching : mutations;
}

function filterEchoConversions(mutations: Mutation[], keywords: ReadonlySet<KeywordId>): Mutation[] {
  const matching = mutations.filter(({ card }) => {
    const effect = card.effects[0];
    return effect?.kind === "damage" && keywords.has(effect.damageType);
  });
  return matching.length > 0 ? matching : mutations;
}

function applyAltarModifiers(
  groups: CorruptionMutationGroup[],
  card: BattleCard,
  modifiers: readonly EncounterRewardTraitId[],
): CorruptionMutationGroup[] {
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
      if (group.kind === "secondary") return { ...group, mutations: filterEchoSecondary(group.mutations, keywords) };
      if (group.kind === "convert") return { ...group, mutations: filterEchoConversions(group.mutations, keywords) };
      return group;
    });
  }
  return shaped;
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
    const secondary: BattleCardEffect[] = [
      { kind: "player-status", status: "block", amount },
      { kind: "heal", amount },
      { kind: "damage", damageType: "poison", amount: damage },
      { kind: "damage", damageType: "burn", amount: damage },
    ];
    add(
      "secondary",
      secondary
        .filter(
          (effect) =>
            !visitBattleCardEffects(
              card.effects,
              (existing) =>
                existing.kind === effect.kind &&
                (effect.kind !== "damage" || existing.kind !== "damage" || existing.damageType === effect.damageType) &&
                (effect.kind !== "player-status" ||
                  existing.kind !== "player-status" ||
                  existing.status === effect.status),
            ),
        )
        .map((effect) => addEffect(card, effect)),
    );
  }
  if (target && !card.consume) {
    if (roomForLine) {
      add("bargain", [
        addEffect(
          applyNumericCorruption(card, target, target.value),
          { kind: "lose-health", amount: CORRUPTION_HEALTH_PRICE },
          true,
        ),
      ]);
      const amount = CORRUPTION_JACKPOT_AMOUNT;
      add("draw", [addEffect(card, { kind: "draw-cards", amount })]);
      add("mana", [addEffect(card, { kind: "restore-mana", amount })]);
    }
    const effect = card.effects[0];
    if (effect && effect.kind === "damage" && !effect.lifesteal && !card.descriptionLines.includes("Leech")) {
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
  return applyAltarModifiers(groups, card, modifiers)
    .map((group) => ({
      ...group,
      mutations: group.mutations.filter(({ card: next }) =>
        next.effects.every((effect) => BattleCardEffectSchema.safeParse(effect).success),
      ),
    }))
    .filter((group) => group.mutations.length > 0);
}
