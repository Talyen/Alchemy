import {
  cloneBattleCard,
  createEffectDescription,
  carryCardDescriptionMarks,
  getCardDescription,
  getCardKeywords,
  getCardEffect,
  mapCardDescriptionReferences,
  type CardMagnitudeReference,
  isMixedPotionCard,
  mapEffectChildren,
  visitBattleCardEffects,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
  type DamageType,
  type KeywordId,
} from "@/lib/game-data";
import { CORRUPTION_MAX_EFFECT_LINES } from "@/lib/game-constants/corruption";
import { TRANSMUTATION_KEYWORD_GROUPS, TRANSMUTATION_PREFIXES } from "@/lib/game-constants/transmutation";
import type {
  AlchemyVisit,
  TransmutationChoice,
  TransmutationAlteration,
} from "@/lib/active-run-session/alchemy-visits";
import { pickRandom } from "@/lib/rng";

const DAMAGE_KEYWORDS = TRANSMUTATION_KEYWORD_GROUPS[0];
const BUFF_KEYWORDS: readonly KeywordId[] = ["block", "armor", "forge", "thorns"];
const RESOURCE_KINDS = { health: "heal", mana: "restore-mana", gold: "gain-gold" } as const;
const SOURCE_CONDITIONS: Partial<Record<KeywordId, readonly string[]>> = {
  burn: ["tripleIfEnemyNotBurning", "detonateAllBurn"],
  bleed: ["doubleIfEnemyBleeding", "detonateAllBleed"],
  freeze: ["damageTypeIfTargetFrozen"],
  stun: ["ifEnemyStunned"],
  block: ["equalToBlock", "equalToBlockPercent"],
  armor: ["equalToArmor"],
  forge: ["forgeBonusPercent"],
};

export function isTransmutableCard(card: BattleCard): boolean {
  return !card.corrupted && !card.transmuted && !isMixedPotionCard(card);
}

function convertibleSource(effect: BattleCardEffect): KeywordId | undefined {
  if (effect.kind === "damage") {
    const fields = ["kind", "damageType", "amount", "lifesteal", "ignoreArmor", "ignoreBlock", "damageTypePool"];
    if (Object.entries(effect).every(([key, value]) => fields.includes(key) || value === false || value === undefined))
      return effect.damageType;
  }
  if (effect.kind === "random-damage" && effect.damageTypePool) return effect.damageTypePool[0];
  if (effect.kind === "player-status") {
    if (
      Object.entries(effect).every(([key, value]) => ["kind", "status", "amount"].includes(key) || value === undefined)
    )
      return BUFF_KEYWORDS.find((keyword) => keyword === effect.status);
  }
  for (const [keyword, kind] of Object.entries(RESOURCE_KINDS)) {
    if (
      effect.kind === kind &&
      Object.entries(effect).every(
        ([key, value]) => ["kind", "amount"].includes(key) || value === false || value === undefined,
      )
    )
      return keyword as KeywordId;
  }
  return undefined;
}

function sourceReferences(effect: BattleCardEffect, source: KeywordId): boolean {
  if (
    effect.kind === "self-damage" ||
    ["lose-health", "lose-mana", "lose-max-mana", "gain-max-mana"].includes(effect.kind)
  )
    return false;
  if (effect.kind === "damage")
    return (
      effect.damageType === source ||
      !!effect.damageTypePool?.some((type) => type === source) ||
      effect.damageTypeIfTargetFrozen === source
    );
  if (effect.kind === "random-damage")
    return (
      DAMAGE_KEYWORDS.includes(source) &&
      (!effect.damageTypePool || effect.damageTypePool.includes(source as DamageType))
    );
  if (effect.kind === "player-status")
    return effect.status === source || !!effect.statusPool?.some((status) => status === source);
  if (effect.kind === "heal") return source === "health";
  if (effect.kind === "restore-mana") return source === "mana";
  if (effect.kind === "gain-gold") return source === "gold";
  if (effect.kind === "next-hit-poison") return source === "poison";
  if ("status" in effect && effect.status === source) return true;
  return "damageType" in effect && effect.damageType === source;
}

function canConvertSource(effects: BattleCardEffect[], source: KeywordId): boolean {
  return !visitBattleCardEffects(effects, (effect) => {
    // A conversion must not leave conditions or scaling tied to the replaced keyword.
    if (
      SOURCE_CONDITIONS[source]?.some(
        (field) =>
          (effect as Record<string, unknown>)[field] !== undefined &&
          (effect as Record<string, unknown>)[field] !== false,
      )
    )
      return true;
    if (!sourceReferences(effect, source)) return false;
    const convertible = convertibleSource(effect);
    return (
      convertible !== source &&
      !(
        (effect.kind === "damage" || effect.kind === "random-damage") &&
        convertible &&
        effect.damageTypePool?.some((type) => type === source)
      )
    );
  });
}

function convertEffect(effect: BattleCardEffect, source: KeywordId, destination: KeywordId): BattleCardEffect {
  const mapped = mapEffectChildren(effect, (child) => convertEffect(child, source, destination));
  if (mapped.kind === "random-damage" && mapped.damageTypePool && DAMAGE_KEYWORDS.includes(destination))
    return {
      ...mapped,
      damageTypePool: mapped.damageTypePool.map((type) => (type === source ? (destination as DamageType) : type)),
    };
  if (mapped.kind === "damage" && DAMAGE_KEYWORDS.includes(destination)) {
    return {
      ...mapped,
      damageType: mapped.damageType === source ? (destination as DamageType) : mapped.damageType,
      ...(mapped.damageTypePool
        ? {
            damageTypePool: mapped.damageTypePool.map((type) => (type === source ? (destination as DamageType) : type)),
          }
        : {}),
    };
  }
  if (mapped.kind === "player-status" && mapped.status === source && BUFF_KEYWORDS.includes(destination))
    return { ...mapped, status: destination as "block" | "armor" | "forge" | "thorns" };
  const resource = RESOURCE_KINDS[destination as keyof typeof RESOURCE_KINDS];
  if (resource && mapped.kind === RESOURCE_KINDS[source as keyof typeof RESOURCE_KINDS])
    return { kind: resource, amount: (mapped as { amount: number }).amount };
  return mapped;
}

function finishAlteration(
  card: BattleCard,
  keyword: KeywordId,
  effects: BattleCardEffect[],
  extra: Partial<BattleCard> = {},
): BattleCard {
  const result = {
    ...card,
    ...extra,
    effects,
    transmuted: keyword,
    baseTitle: card.title,
    title: `${TRANSMUTATION_PREFIXES[keyword]} ${card.title}`,
  };
  const previous = mapCardDescriptionReferences(
    getCardDescription(card),
    (reference) =>
      ({
        ...reference,
        kind: getCardEffect(effects, reference)?.kind ?? reference.kind,
      }) as CardMagnitudeReference,
  );
  const description = carryCardDescriptionMarks(previous, createEffectDescription(effects));
  for (const tag of result.tags ?? [])
    description.push({ role: "keyword", parts: [tag.charAt(0).toUpperCase() + tag.slice(1)] });
  if (result.consume) description.push({ role: "consume", parts: ["Consume"] });
  return cloneBattleCard(withCardDescription(result, description));
}

export function getTransmutationVariants(
  card: BattleCard,
  keyword: KeywordId,
  deck: readonly BattleCard[],
): Array<{ sourceKeyword: KeywordId | null; result: BattleCard }> {
  if (!isTransmutableCard(card) || getCardKeywords(card).includes(keyword)) return [];
  // Companion-only Wishes are omitted from affinity metadata but still grant Wish.
  if (keyword === "wish" && visitBattleCardEffects(card.effects, (effect) => effect.kind === "wish")) return [];
  const family = DAMAGE_KEYWORDS.includes(keyword)
    ? DAMAGE_KEYWORDS
    : BUFF_KEYWORDS.includes(keyword)
      ? BUFF_KEYWORDS
      : Object.hasOwn(RESOURCE_KINDS, keyword)
        ? (Object.keys(RESOURCE_KINDS) as KeywordId[])
        : null;
  if (family) {
    const sources = new Set<KeywordId>();
    visitBattleCardEffects(card.effects, (effect) => {
      const source = convertibleSource(effect);
      if (
        source &&
        family.includes(source) &&
        (effect.kind === "random-damage" ||
          ("amount" in effect && typeof effect.amount === "number" && effect.amount > 0))
      ) {
        if ((effect.kind === "damage" || effect.kind === "random-damage") && effect.damageTypePool)
          for (const type of effect.damageTypePool) sources.add(type);
        else sources.add(source);
      }
    });
    return [...sources]
      .filter((source) => source !== keyword && canConvertSource(card.effects, source))
      .map((sourceKeyword) => ({
        sourceKeyword,
        result: finishAlteration(
          card,
          keyword,
          card.effects.map((effect) => convertEffect(effect, sourceKeyword, keyword)),
        ),
      }));
  }
  const effects = [...card.effects];
  if (keyword === "archery" || keyword === "leech") {
    let damage = false;
    const infuseDamage = (effect: BattleCardEffect): BattleCardEffect => {
      if (
        effect.kind === "damage" ||
        effect.kind === "random-damage" ||
        effect.kind === "cleanse-player-status-to-damage"
      ) {
        damage = true;
        return keyword === "leech" ? { ...effect, lifesteal: true } : effect;
      }
      return mapEffectChildren(effect, infuseDamage);
    };
    const altered = effects.map(infuseDamage);
    if (!damage) return [];
    const result = finishAlteration(
      card,
      keyword,
      altered,
      keyword === "archery" ? { tags: [...(card.tags ?? []), "archery"] } : {},
    );
    // Leech can expand combined damage lines; count the actual preview.
    if (
      keyword === "leech" &&
      getCardDescription(result).filter((line) => line.role === "effect").length > CORRUPTION_MAX_EFFECT_LINES
    )
      return [];
    return [{ sourceKeyword: null, result }];
  }
  if (keyword === "consume")
    return [{ sourceKeyword: null, result: finishAlteration(card, keyword, effects, { consume: true }) }];
  if (getCardDescription(card).filter((line) => line.role === "effect").length >= CORRUPTION_MAX_EFFECT_LINES)
    return [];
  if (keyword === "wish") effects.push({ kind: "wish", amount: 1 });
  else if (keyword === "dodge") effects.push({ kind: "dodge-next-attack" });
  else if (
    keyword === "companion" &&
    deck.some((entry) => visitBattleCardEffects(entry.effects, (effect) => effect.kind === "summon-companion"))
  )
    effects.push({ kind: "companion-action", amount: 1 });
  else return [];
  return [{ sourceKeyword: null, result: finishAlteration(card, keyword, effects) }];
}

export function createTransmutationOffers(deck: readonly BattleCard[], rng: () => number): TransmutationChoice[] {
  // Eligibility and selection share previews without consuming extra RNG or
  // retaining cards beyond this visit's generation.
  const variants = deck.map(() => new Map<KeywordId, ReturnType<typeof getTransmutationVariants>>());
  function variantsFor(sourceIndex: number, keyword: KeywordId) {
    const saved = variants[sourceIndex]!;
    let result = saved.get(keyword);
    if (!result) {
      result = getTransmutationVariants(deck[sourceIndex]!, keyword, deck);
      saved.set(keyword, result);
    }
    return result;
  }
  const pools = TRANSMUTATION_KEYWORD_GROUPS.map((group) =>
    group.filter((keyword) => deck.some((_card, index) => variantsFor(index, keyword).length > 0)),
  );
  const keywords: KeywordId[] = [];
  for (const pool of pools) {
    const keyword = pickRandom(pool, rng);
    if (keyword) keywords.push(keyword);
  }
  const remaining = pools.flat().filter((keyword) => !keywords.includes(keyword));
  while (keywords.length < 3 && remaining.length) {
    const keyword = pickRandom(remaining, rng)!;
    keywords.push(keyword);
    remaining.splice(remaining.indexOf(keyword), 1);
  }
  return keywords.map((keyword) => ({
    keyword,
    alterations: deck.flatMap((source, sourceIndex) => {
      const alteration = pickRandom(variantsFor(sourceIndex, keyword), rng);
      return alteration ? [{ ...alteration, source: cloneBattleCard(source), sourceIndex }] : [];
    }),
  }));
}

function cardSnapshotKey(card: BattleCard | null | undefined): string | undefined {
  return JSON.stringify(card, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  );
}

function matchingAlteration(
  choice: TransmutationChoice,
  key: string | undefined,
  sourceIndex?: number,
  cardId?: string,
): TransmutationAlteration | undefined {
  return choice.alterations.find(
    (entry) =>
      (sourceIndex === undefined || sourceIndex === entry.sourceIndex) &&
      (cardId === undefined || entry.source.id === cardId) &&
      cardSnapshotKey(entry.source) === key,
  );
}

export function getTransmutationOffers(visit: AlchemyVisit): BattleCard[] {
  if (!selection) return [];
  const { source, sourceIndex } = selection;
  if (!source || sourceIndex == null) return [];
  const key = cardSnapshotKey(source);
  return selection.choices.flatMap((choice) => {
    const alteration = matchingAlteration(choice, key, sourceIndex, source.id);
    return alteration ? [alteration.result] : [];
  });
}

export function canTransmuteCard(
  choices: readonly TransmutationChoice[],
  card: BattleCard,
  sourceIndex?: number,
  deck?: readonly BattleCard[],
): boolean {
  if (!isTransmutableCard(card)) return false;
  const key = cardSnapshotKey(card);
  return choices.some((choice) => {
    const alteration = matchingAlteration(choice, key, sourceIndex, card.id);
    return (
      !!alteration &&
      (!deck ||
        getTransmutationVariants(card, choice.keyword, deck).some(
          (variant) => variant.sourceKeyword === alteration.sourceKeyword,
        ))
    );
  });
}

export function isTransmutationSourceCurrent(visit: AlchemyVisit, deck: readonly BattleCard[]): boolean {
  const selection = visit.transmutation;
  const source =
    selection?.sourceIndex === null || selection?.sourceIndex === undefined ? undefined : deck[selection.sourceIndex];
  return (
    !!source && source.id === selection?.source?.id && cardSnapshotKey(source) === cardSnapshotKey(selection?.source)
  );
}
