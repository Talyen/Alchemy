import { capitalizeWord } from "@/lib/utils";
import { conditionalDamageDescription } from "./cards/conditional-damage-description";
import type { BattleCard, BattleCardEffect, KeywordId } from "./types";

interface EffectPresentation<K extends BattleCardEffect["kind"]> {
  canonical?: true;
  keywords: (effect: Extract<BattleCardEffect, { kind: K }>) => KeywordId[];
  describe?: (effect: Extract<BattleCardEffect, { kind: K }>) => string;
}

const PRESENTATION: { [K in BattleCardEffect["kind"]]: EffectPresentation<K> } = {
  damage: {
    keywords: (effect) =>
      dedupeKeywords(
        effect.damageTypePool?.length ? effect.damageTypePool : [effect.damageType],
        effect.lifesteal ? ["leech"] : [],
        effect.damageTypeIfTargetHasBlock ? [effect.damageTypeIfTargetHasBlock] : [],
        effect.damageTypeIfTargetFrozen ? [effect.damageTypeIfTargetFrozen] : [],
        effect.blockCost !== undefined ? ["block"] : [],
      ),
    describe: (effect) => {
      if (conditionalDamageDescription(effect)) return conditionalDamageDescription(effect)!;
      if (effect.damageTypePool && effect.damageTypePool.length > 0) {
        const types = [...effect.damageTypePool].map(capitalizeWord);
        const last = types.pop();
        return `Deal ${effect.amount} ${types.join(", ")}, or ${last} damage`;
      }
      return `Deal ${effect.amount} ${capitalizeWord(effect.damageType)} damage`;
    },
  },
  "cleanse-player-status-to-damage": { keywords: (effect) => [effect.status, effect.damageType] },
  "random-damage": {
    canonical: true,
    keywords: (effect) => (effect.damageTypePool?.length ? effect.damageTypePool : ["physical"]),
    describe: (effect) => {
      if (effect.damageTypePool?.length) {
        const types = effect.damageTypePool.map(capitalizeWord);
        const last = types.pop();
        return `Deal ${effect.minAmount}–${effect.maxAmount} ${types.join(", ")}, or ${last} damage`;
      }
      return `Deal ${effect.minAmount}–${effect.maxAmount} Random damage`;
    },
  },
  chance: { keywords: (effect) => collectKeywordsFromChance(effect) },
  "player-status": {
    keywords: (effect) =>
      effect.statusPool ?? (effect.status !== "haste" && effect.status !== "phoenixFeather" ? [effect.status] : []),
    describe: (effect) => {
      if (effect.statusPool) return playerStatusChoiceDescriptionLine(effect.statusPool, effect.amount);
      if (
        effect.status === "block" ||
        effect.status === "armor" ||
        effect.status === "thorns" ||
        effect.status === "forge"
      )
        return playerStatusDescriptionLine(effect.status, effect.amount);
      throw new Error(`effectDescriptionLine: unsupported player-status ${effect.status}`);
    },
  },
  "enemy-status": {
    keywords: (effect) =>
      effect.status === "burn" ||
      effect.status === "poison" ||
      effect.status === "bleed" ||
      effect.status === "freeze" ||
      effect.status === "stun"
        ? [effect.status]
        : [],
  },
  heal: {
    canonical: true,
    keywords: () => ["health"],
    describe: (effect) => {
      return `Restore ${effect.amount} Health`;
    },
  },
  "restore-mana": {
    keywords: () => ["mana"],
    describe: (effect) => {
      return `Gain ${effect.amount} Mana`;
    },
  },
  "lose-mana": {
    canonical: true,
    keywords: () => ["mana"],
    describe: (effect) => {
      return `Lose ${effect.amount} Mana`;
    },
  },
  "lose-max-mana": {
    canonical: true,
    keywords: () => ["mana"],
    describe: (effect) => {
      return `Lose ${effect.amount} Mana Crystal${effect.amount === 1 ? "" : "s"}`;
    },
  },
  "gain-max-mana": {
    canonical: true,
    keywords: () => ["mana"],
    describe: (effect) => {
      return `Gain ${effect.amount} Mana Crystal${effect.amount === 1 ? "" : "s"}`;
    },
  },
  "gain-gold": {
    keywords: () => ["gold"],
    describe: (effect) => {
      return `Gain ${effect.amount} Gold`;
    },
  },
  wish: {
    canonical: true,
    keywords: () => ["wish"],
    describe: (effect) => {
      return `Wish ${effect.amount}`;
    },
  },
  "summon-companion": { keywords: () => ["companion"] },
  "buff-companion": { keywords: () => ["companion"] },
  "companion-action": { keywords: () => ["companion"] },
  "random-draw": { keywords: () => [] },
  "remove-harmful-status": {
    keywords: () => [],
    describe: (effect) => {
      {
        if (effect.removeAll) return "Cleanse all harmful status effects";
        if (effect.amount === undefined)
          throw new Error("effectDescriptionLine: remove-harmful-status needs amount without removeAll");
        return `Cleanse ${effect.amount} harmful status effect${effect.amount === 1 ? "" : "s"}`;
      }
    },
  },
  "lose-health": {
    canonical: true,
    keywords: () => ["health"],
    describe: (effect) => {
      return `Lose ${effect.amount} Health`;
    },
  },
  "draw-cards": {
    canonical: true,
    keywords: () => [],
    describe: (effect) => {
      return effect.amount === 1 ? "Draw a card" : `Draw ${effect.amount} cards`;
    },
  },
  "remove-enemy-armor": {
    keywords: () => ["armor"],
    describe: (effect) => {
      {
        if (effect.halve) return "Halve enemy Armor";
        if (effect.removeAll) return "Remove all enemy Armor";
        if (effect.amount === undefined)
          throw new Error("effectDescriptionLine: remove-enemy-armor needs amount without removeAll");
        return `Remove ${effect.amount} enemy Armor`;
      }
    },
  },
  "multiply-enemy-status": { keywords: (effect) => [effect.status] },
  "remove-player-status": { keywords: (effect) => [effect.status] },
  "self-damage": {
    canonical: true,
    keywords: (effect) => [effect.damageType],
    describe: (effect) => {
      return `Take ${effect.amount} ${capitalizeWord(effect.damageType)} damage`;
    },
  },
  "repeat-over-turns": { keywords: (effect) => effect.effects.flatMap(collectKeywordsFromBattleEffect) },
  "next-hit-crit": {
    canonical: true,
    keywords: () => [],
    describe: () => {
      return "Your next damaging card is a critical strike";
    },
  },
  "next-hit-leech": {
    canonical: true,
    keywords: () => ["leech"],
    describe: () => {
      return "Your next damaging card has Leech";
    },
  },
  "play-next-card-twice": {
    canonical: true,
    keywords: () => [],
    describe: () => {
      return "Your next card is played twice";
    },
  },
  "next-hit-poison": {
    canonical: true,
    keywords: () => [],
    describe: () => {
      return "Your next attack is converted to Poison damage";
    },
  },
  "next-archery-free": {
    canonical: true,
    keywords: () => ["archery"],
    describe: () => {
      return "Your next Archery card is free";
    },
  },
};

export function effectDescriptionLine(effect: BattleCardEffect): string {
  const describe = PRESENTATION[effect.kind].describe;
  if (!describe) throw new Error(`effectDescriptionLine: unsupported effect kind ${effect.kind}`);
  return describe(effect as never);
}

function dedupeKeywords(...iterables: readonly KeywordId[][]): KeywordId[] {
  const seen = new Set<KeywordId>();
  const result: KeywordId[] = [];
  for (const arr of iterables) {
    for (const kw of arr) {
      if (!seen.has(kw)) {
        seen.add(kw);
        result.push(kw);
      }
    }
  }
  return result;
}

function collectKeywordsFromChance(effect: Extract<BattleCardEffect, { kind: "chance" }>): KeywordId[] {
  return dedupeKeywords(
    effect.successEffects.flatMap(collectKeywordsFromBattleEffect),
    effect.failureEffects.flatMap(collectKeywordsFromBattleEffect),
  );
}

export function collectKeywordsFromBattleEffect(effect: BattleCardEffect): KeywordId[] {
  return PRESENTATION[effect.kind].keywords(effect as never);
}

type PlayerStatusDescriptionStatus = "block" | "armor" | "thorns" | "forge";

function playerStatusDescriptionLine(status: PlayerStatusDescriptionStatus, amount: number): string {
  return `Gain ${amount} ${capitalizeWord(status)}`;
}

function playerStatusChoiceDescriptionLine(statuses: readonly PlayerStatusDescriptionStatus[], amount: number): string {
  const labels = statuses.map(capitalizeWord);
  const last = labels.pop();
  return `Gain ${amount} ${labels.join(", ")}, or ${last}`;
}

/** Exact canonical text needs no second number parser. Custom and saved wording still uses parity rules. */
export function canonicalCardDescriptionMatches(card: BattleCard): boolean {
  if (!card.effects.length || card.effects.some((effect) => !PRESENTATION[effect.kind].canonical)) return false;
  const expected = card.effects.map(effectDescriptionLine);
  if (card.tags) expected.push(...card.tags.map(capitalizeWord));
  if (card.consume) expected.push("Consume");
  return (
    expected.length === card.descriptionLines.length &&
    expected.every((line, index) => line === card.descriptionLines[index])
  );
}
