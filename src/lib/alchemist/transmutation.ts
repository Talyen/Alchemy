import {
  cloneBattleCard,
  appendCardDescriptionTrailer,
  createEffectDescription,
  carryCardDescriptionMarks,
  cardHasKeyword,
  getCardDescription,
  getCardEffect,
  mapCardDescriptionReferences,
  type CardMagnitudeReference,
  isMixedPotionCard,
  isCompanionSummonCard,
  mapEffectChildren,
  visitBattleCardEffects,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
  type DamageType,
  type KeywordId,
} from "@/lib/game-data";
import {
  CORRUPTION_MAX_EFFECT_LINES,
  TRANSMUTATION_KEYWORD_GROUPS,
  TRANSMUTATION_PREFIXES,
} from "@/lib/game-constants";
import type {
  AlchemyVisit,
  TransmutationChoice,
  TransmutationAlteration,
} from "@/lib/active-run-session/alchemy-visits";
import { pickRandom, takeRandomItem } from "@/lib/rng";
import { stableJson } from "@/lib/utils";
import { transmutationModifierKeyword } from "@/lib/content-systems/labyrinth/trait-catalog";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";

const DAMAGE_KEYWORDS: readonly KeywordId[] = TRANSMUTATION_KEYWORD_GROUPS[0];
const BUFF_KEYWORDS: readonly KeywordId[] = ["block", "armor", "forge", "thorns"];
const BUFF_KEYWORD_SET = new Set<string>(BUFF_KEYWORDS);
const RESOURCE_KINDS = { health: "heal", mana: "restore-mana", gold: "gain-gold" } as const;
const RESOURCE_KEYWORDS = Object.keys(RESOURCE_KINDS) as KeywordId[];
const ALLOWED_DAMAGE_FIELDS = new Set([
  "kind",
  "damageType",
  "amount",
  "lifesteal",
  "ignoreArmor",
  "ignoreBlock",
  "damageTypePool",
]);
const ALLOWED_PLAYER_STATUS_FIELDS = new Set(["kind", "status", "amount"]);
const ALLOWED_RESOURCE_FIELDS = new Set(["kind", "amount"]);
const ALLOWED_RANDOM_DAMAGE_FIELDS = new Set(["kind", "minAmount", "maxAmount", "damageTypePool", "lifesteal"]);
const EXCLUDED_KINDS = new Set(["self-damage", "lose-health", "lose-mana", "lose-max-mana", "gain-max-mana"]);

const SOURCE_CONDITIONS: Partial<Record<KeywordId, readonly string[]>> = {
  burn: ["tripleIfEnemyNotBurning", "detonateAllBurn"],
  bleed: ["doubleIfEnemyBleeding", "detonateAllBleed"],
  freeze: ["damageTypeIfTargetFrozen"],
  stun: ["ifEnemyStunned"],
  block: ["equalToBlock", "equalToBlockPercent"],
  armor: ["equalToArmor"],
  forge: ["forgeBonusPercent"],
};

function hasEffectLines(card: BattleCard, minimum: number): boolean {
  let count = 0;
  for (const line of getCardDescription(card)) {
    if (line.role === "effect" && ++count >= minimum) return true;
  }
  return false;
}

function isTransmutableCard(card: BattleCard): boolean {
  return !card.corrupted && !card.transmuted && !isMixedPotionCard(card);
}

function hasOnlyAllowedFields(obj: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(obj).every((key) => allowed.has(key) || obj[key] === false || obj[key] === undefined);
}

function convertibleSource(effect: BattleCardEffect): KeywordId | undefined {
  const record = effect as unknown as Record<string, unknown>;
  if (effect.kind === "damage") {
    if (hasOnlyAllowedFields(record, ALLOWED_DAMAGE_FIELDS)) return effect.damageType;
  }
  if (effect.kind === "random-damage" && effect.damageTypePool) {
    if (hasOnlyAllowedFields(record, ALLOWED_RANDOM_DAMAGE_FIELDS)) return effect.damageTypePool[0];
    return undefined;
  }
  if (effect.kind === "player-status") {
    if (hasOnlyAllowedFields(record, ALLOWED_PLAYER_STATUS_FIELDS) && BUFF_KEYWORD_SET.has(effect.status)) {
      return effect.status as KeywordId;
    }
  }
  if (effect.kind === "heal" && hasOnlyAllowedFields(record, ALLOWED_RESOURCE_FIELDS)) return "health";
  if (effect.kind === "restore-mana" && hasOnlyAllowedFields(record, ALLOWED_RESOURCE_FIELDS)) return "mana";
  if (effect.kind === "gain-gold" && hasOnlyAllowedFields(record, ALLOWED_RESOURCE_FIELDS)) return "gold";
  return undefined;
}

function sourceReferences(effect: BattleCardEffect, source: KeywordId): boolean {
  if (EXCLUDED_KINDS.has(effect.kind)) return false;
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
  if (
    (mapped.kind === "damage" || mapped.kind === "random-damage") &&
    mapped.damageTypePool &&
    DAMAGE_KEYWORDS.includes(destination)
  ) {
    const damageTypePool = mapped.damageTypePool.map((type) => (type === source ? (destination as DamageType) : type));
    if (mapped.kind === "random-damage") return { ...mapped, damageTypePool };
    return {
      ...mapped,
      damageType: mapped.damageType === source ? (destination as DamageType) : mapped.damageType,
      damageTypePool,
    };
  }
  if (mapped.kind === "damage" && DAMAGE_KEYWORDS.includes(destination)) {
    return {
      ...mapped,
      damageType: mapped.damageType === source ? (destination as DamageType) : mapped.damageType,
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
  appendCardDescriptionTrailer(description, result.tags, result.consume === true);
  return cloneBattleCard(withCardDescription(result, description));
}

interface PendingVariant {
  sourceKeyword: KeywordId | null;
  build: () => BattleCard;
}

function getPendingVariants(card: BattleCard, keyword: KeywordId, hasCompanion: () => boolean): PendingVariant[] {
  if (!isTransmutableCard(card) || cardHasKeyword(card, keyword)) return [];
  // Companion-only Wishes are omitted from affinity metadata but still grant Wish.
  if (keyword === "wish" && visitBattleCardEffects(card.effects, (effect) => effect.kind === "wish")) return [];
  const family = DAMAGE_KEYWORDS.includes(keyword)
    ? DAMAGE_KEYWORDS
    : BUFF_KEYWORDS.includes(keyword)
      ? BUFF_KEYWORDS
      : Object.hasOwn(RESOURCE_KINDS, keyword)
        ? RESOURCE_KEYWORDS
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
    const variants: PendingVariant[] = [];
    for (const sourceKeyword of sources) {
      if (sourceKeyword === keyword || !canConvertSource(card.effects, sourceKeyword)) continue;
      variants.push({
        sourceKeyword,
        build: () =>
          finishAlteration(
            card,
            keyword,
            card.effects.map((effect) => convertEffect(effect, sourceKeyword, keyword)),
          ),
      });
    }
    return variants;
  }
  if (keyword === "archery") {
    const damage = visitBattleCardEffects(
      card.effects,
      (effect) =>
        effect.kind === "damage" ||
        effect.kind === "random-damage" ||
        effect.kind === "cleanse-player-status-to-damage",
    );
    if (!damage) return [];
    const effects = [...card.effects];
    return [
      {
        sourceKeyword: null,
        build: () => finishAlteration(card, keyword, effects, { tags: [...(card.tags ?? []), "archery"] }),
      },
    ];
  }
  if (keyword === "leech") {
    let damage = false;
    const infuseDamage = (effect: BattleCardEffect): BattleCardEffect => {
      if (
        effect.kind === "damage" ||
        effect.kind === "random-damage" ||
        effect.kind === "cleanse-player-status-to-damage"
      ) {
        damage = true;
        return { ...effect, lifesteal: true };
      }
      return mapEffectChildren(effect, infuseDamage);
    };
    const altered = card.effects.map(infuseDamage);
    if (!damage) return [];
    // Leech can expand combined damage lines; count the actual preview.
    const result = finishAlteration(card, keyword, altered);
    if (hasEffectLines(result, CORRUPTION_MAX_EFFECT_LINES + 1)) return [];
    return [{ sourceKeyword: null, build: () => result }];
  }
  if (keyword === "consume" && !isCompanionSummonCard(card)) {
    const effects = [...card.effects];
    return [{ sourceKeyword: null, build: () => finishAlteration(card, keyword, effects, { consume: true }) }];
  }
  if (keyword !== "wish" && keyword !== "dodge" && keyword !== "companion") return [];
  if (hasEffectLines(card, CORRUPTION_MAX_EFFECT_LINES)) return [];
  if (keyword === "companion" && !hasCompanion()) return [];
  const effects = [...card.effects];
  if (keyword === "wish") effects.push({ kind: "wish", amount: 1 });
  else if (keyword === "dodge") effects.push({ kind: "dodge-next-attack" });
  else effects.push({ kind: "companion-action", amount: 1 });
  return [{ sourceKeyword: null, build: () => finishAlteration(card, keyword, effects) }];
}

export function getTransmutationVariants(
  card: BattleCard,
  keyword: KeywordId,
  deck: readonly BattleCard[],
): Array<{ sourceKeyword: KeywordId | null; result: BattleCard }> {
  return getPendingVariants(card, keyword, () => deck.some(isCompanionSummonCard)).map(({ sourceKeyword, build }) => ({
    sourceKeyword,
    result: build(),
  }));
}

/** Check compatibility without building every preview; Leech still needs a line-count preview. */
export function hasTransmutationVariant(card: BattleCard, keyword: KeywordId, hasCompanion: () => boolean): boolean {
  return getPendingVariants(card, keyword, hasCompanion).length > 0;
}

export function createTransmutationOffers(
  deck: readonly BattleCard[],
  rng: () => number,
  modifiers: readonly EncounterRewardTraitId[] = [],
): TransmutationChoice[] {
  const prismatic = modifiers.includes("prismatic-crucible");
  let guaranteed: KeywordId | undefined;
  if (!prismatic) {
    for (const modifier of modifiers) {
      guaranteed = transmutationModifierKeyword(modifier);
      if (guaranteed !== undefined) break;
    }
  }
  const choices = new Map<KeywordId, TransmutationChoice>();
  let companionPresent: boolean | undefined;
  const hasCompanion = () => (companionPresent ??= deck.some(isCompanionSummonCard));
  deck.forEach((source, sourceIndex) => {
    if (!isTransmutableCard(source)) return;
    // Roll against this card so unrelated cards cannot crowd out useful choices.
    const pools = TRANSMUTATION_KEYWORD_GROUPS.map((group) =>
      group.flatMap((keyword) => {
        const alterations = getPendingVariants(source, keyword, hasCompanion);
        return alterations.length ? [{ keyword, alterations }] : [];
      }),
    );
    const available = pools.flat();
    const selected = prismatic ? [...available] : [];
    const guaranteedOffer =
      prismatic || guaranteed === undefined ? undefined : available.find((offer) => offer.keyword === guaranteed);
    if (!prismatic && guaranteedOffer) selected.push(guaranteedOffer);
    for (const pool of pools) {
      if (prismatic || pool.some((offer) => selected.includes(offer))) continue;
      const offer = pickRandom(pool, rng);
      if (offer) selected.push(offer);
    }
    if (selected.length < 3) {
      const remaining = available.filter((offer) => !selected.includes(offer));
      while (selected.length < 3 && remaining.length) {
        selected.push(takeRandomItem(remaining, rng)!);
      }
    }
    for (const { keyword, alterations } of selected) {
      const alteration = pickRandom(alterations, rng)!;
      let choice = choices.get(keyword);
      if (!choice) {
        choice = { keyword, alterations: [] };
        choices.set(keyword, choice);
      }
      choice.alterations.push({
        sourceKeyword: alteration.sourceKeyword,
        result: alteration.build(),
        source: cloneBattleCard(source),
        sourceIndex,
      });
    }
  });
  return [...choices.values()];
}

/** Saved sources match live cards exactly; even a cost drift makes the preview stale. */
function cardSnapshotKey(card: BattleCard): string {
  return stableJson(card);
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
  const selection = visit.transmutation;
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
  let companionPresent: boolean | undefined;
  return choices.some((choice) => {
    const alteration = matchingAlteration(choice, key, sourceIndex, card.id);
    return (
      !!alteration &&
      // The saved alteration already proves compatibility with this exact
      // source. Only Companion additions depend on the rest of the live deck.
      (!deck || choice.keyword !== "companion" || (companionPresent ??= deck.some(isCompanionSummonCard)))
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
