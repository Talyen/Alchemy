import { CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";
import { capitalizeWord } from "@/lib/utils";
import { conditionalDamageDescription } from "./cards/conditional-damage-description";
import type { BattleCard, BattleCardEffect, KeywordId } from "./types";

interface EffectPresentation<K extends BattleCardEffect["kind"]> {
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
      const type = capitalizeWord(effect.damageType);
      if (effect.equalToBlock) {
        const percent = effect.equalToBlockPercent ?? 100;
        const fraction = percent === 100 ? "" : percent === 50 ? "half " : `${percent}% of `;
        return `Deal ${type} damage equal to ${fraction}your Block`;
      }
      if (effect.equalToArmor) return `Deal ${type} damage equal to your Armor`;
      if (effect.equalToForge) return `Deal ${type} damage equal to your Forge`;
      if (effect.equalToGoldPercent !== undefined)
        return `Deal ${type} damage equal to ${effect.equalToGoldPercent}% of your Gold`;
      if (conditionalDamageDescription(effect)) return conditionalDamageDescription(effect)!;
      if (effect.damageTypePool && effect.damageTypePool.length > 0) {
        const types = [...effect.damageTypePool].map(capitalizeWord);
        const last = types.pop();
        return `Deal ${effect.amount} ${types.join(", ")}${types.length > 1 ? "," : ""} or ${last} damage`;
      }
      return `Deal ${effect.amount} ${capitalizeWord(effect.damageType)} damage`;
    },
  },
  "cleanse-player-status-to-damage": { keywords: (effect) => [effect.status, effect.damageType] },
  "random-damage": {
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
      if (effect.perManaCrystal !== undefined)
        return `Gain ${effect.perManaCrystal} ${capitalizeWord(effect.status)} per Mana Crystal`;
      if (effect.convertCurrentMana !== undefined)
        return `Convert each of your Mana into ${effect.convertCurrentMana} ${capitalizeWord(effect.status)}`;
      if (effect.status === "haste")
        return effect.amount === 1
          ? "Take an extra turn after this one"
          : `Take ${effect.amount} extra turns after this one`;
      if (effect.status === "phoenixFeather")
        return `Upon death, revive with ${Math.round(CAMPFIRE_HEAL_FRACTION * 100)}% Health`;
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
    keywords: () => ["health"],
    describe: (effect) => {
      return `Restore ${effect.amount} Health`;
    },
  },
  "restore-mana": {
    keywords: () => ["mana"],
    describe: (effect) => {
      return `${effect.ifEnemyFrozen ? "If the enemy is Frozen, gain" : "Gain"} ${effect.amount} Mana${effect.allowOverflow ? ", allowing overflow" : ""}`;
    },
  },
  "lose-mana": {
    keywords: () => ["mana"],
    describe: (effect) => {
      return `Lose ${effect.amount} Mana`;
    },
  },
  "lose-max-mana": {
    keywords: () => ["mana"],
    describe: (effect) => {
      return `Lose ${effect.amount} Mana Crystal${effect.amount === 1 ? "" : "s"}`;
    },
  },
  "gain-max-mana": {
    keywords: () => ["mana"],
    describe: (effect) => {
      return `Gain ${effect.amount} Mana Crystal${effect.amount === 1 ? "" : "s"}`;
    },
  },
  "gain-gold": {
    keywords: () => ["gold"],
    describe: (effect) => {
      return `Gain ${effect.amount} Gold${effect.ifEnemyStunned ? " if the enemy is Stunned" : ""}`;
    },
  },
  wish: {
    keywords: () => ["wish"],
    describe: (effect) => {
      return `Wish ${effect.amount}`;
    },
  },
  "summon-companion": { keywords: () => ["companion"] },
  "buff-companion": { keywords: () => ["companion"] },
  "companion-action": {
    keywords: () => ["companion"],
    describe: (effect) =>
      `Your Companion acts ${effect.amount === 1 ? "once" : effect.amount === 2 ? "twice" : `${effect.amount} times`}`,
  },
  "random-draw": { keywords: () => [], describe: (effect) => `Draw ${effect.minAmount}–${effect.maxAmount} cards` },
  "remove-harmful-status": {
    keywords: () => [],
    describe: (effect) => {
      {
        if (effect.removeAll) return "Cleanse all harmful status effects";
        if (effect.amount === undefined)
          throw new Error("effectDescriptionLine: remove-harmful-status needs amount without removeAll");
        return effect.amount === 1
          ? "Cleanse a harmful status effect"
          : `Cleanse ${effect.amount} harmful status effects`;
      }
    },
  },
  "lose-health": {
    keywords: () => ["health"],
    describe: (effect) => {
      return `Lose ${effect.amount} Health`;
    },
  },
  "draw-cards": {
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
  "multiply-enemy-status": {
    keywords: (effect) => [effect.status],
    describe: (effect) =>
      `${effect.factor === 2 ? "Double" : `Multiply by ${effect.factor}`} the enemy's ${capitalizeWord(effect.status)}${effect.status === "stun" || effect.status === "freeze" ? " build-up" : ""}`,
  },
  "remove-player-status": {
    keywords: (effect) => [effect.status],
    describe: (effect) =>
      `Cleanse ${capitalizeWord(effect.status)}${effect.status === "stun" || effect.status === "freeze" ? " build-up" : ""}`,
  },
  "self-damage": {
    keywords: (effect) => [effect.damageType],
    describe: (effect) => {
      return `Take ${effect.amount} ${capitalizeWord(effect.damageType)} damage`;
    },
  },
  "repeat-over-turns": { keywords: (effect) => effect.effects.flatMap(collectKeywordsFromBattleEffect) },
  "next-hit-crit": {
    keywords: () => [],
    describe: () => {
      return "Your next damaging card is a critical strike";
    },
  },
  "next-hit-leech": {
    keywords: () => ["leech"],
    describe: () => {
      return "Your next attack has Leech";
    },
  },
  "play-next-card-twice": {
    keywords: () => [],
    describe: () => {
      return "Your next card is played twice";
    },
  },
  "next-hit-poison": {
    keywords: () => [],
    describe: () => {
      return "Your next attack deals Poison";
    },
  },
  "next-archery-free": {
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

function resourceChoices(effect: BattleCardEffect): Array<{ label: string; amount: number }> | null {
  if (effect.kind === "restore-mana" && !effect.ifEnemyFrozen && !effect.allowOverflow)
    return [{ label: "Mana", amount: effect.amount }];
  if (effect.kind === "gain-gold" && !effect.ifEnemyStunned) return [{ label: "Gold", amount: effect.amount }];
  if (
    effect.kind === "player-status" &&
    effect.status === "block" &&
    !effect.statusPool &&
    effect.perManaCrystal === undefined &&
    effect.convertCurrentMana === undefined
  )
    return [{ label: "Block", amount: effect.amount }];
  if (effect.kind === "chance" && effect.successEffects.length === 1 && effect.failureEffects.length === 1) {
    const success = resourceChoices(effect.successEffects[0]!);
    const failure = resourceChoices(effect.failureEffects[0]!);
    return success && failure ? [...success, ...failure] : null;
  }
  return null;
}

/** All mechanic clauses derive from effects; no numeric prose is authored independently. */
export function describeCardEffects(effects: readonly BattleCardEffect[]): string[] {
  const lines: string[] = [];
  for (let index = 0; index < effects.length; index++) {
    const effect = effects[index]!;
    const next = effects[index + 1];
    if (
      effect.kind === "remove-player-status" &&
      next?.kind === "remove-player-status" &&
      effect.status === "stun" &&
      next.status === "freeze"
    ) {
      lines.push("Cleanse Stun and Freeze build-up");
      index++;
      continue;
    }
    if (next && effect.kind === "damage" && !effect.lifesteal) {
      if (
        next.kind === "self-damage" &&
        next.amount === effect.amount &&
        next.damageType === effect.damageType &&
        Object.keys(effect).length === 3
      ) {
        lines.push(`Deal and Receive ${effect.amount} ${capitalizeWord(effect.damageType)} damage`);
        index++;
        continue;
      }
      if (JSON.stringify(effect) === JSON.stringify(next)) {
        const described = describeCardEffects([effect]);
        if (described.length === 1) {
          lines.push(`${described[0]} twice`);
          index++;
          continue;
        }
      }
      if (
        next.kind === "repeat-over-turns" &&
        next.remainingTurns === 1 &&
        next.effects.length === 1 &&
        JSON.stringify(effect) === JSON.stringify(next.effects[0])
      ) {
        const described = describeCardEffects([effect]);
        if (described.length === 1) {
          lines.push(`${described[0]} this turn and next`);
          index++;
          continue;
        }
      }
    }
    if (effect.kind === "chance") {
      const success = effect.successEffects[0];
      const failure = effect.failureEffects[0];
      if (
        effect.probability === 0.5 &&
        effect.successEffects.length === 1 &&
        effect.failureEffects.length === 1 &&
        success?.kind === "wish" &&
        success.amount === 1 &&
        failure?.kind === "gain-gold" &&
        !failure.ifEnemyStunned
      ) {
        lines.push(`Gain ${failure.amount} Gold or Wish`);
        continue;
      }
      const choices = resourceChoices(effect);
      if (choices && choices.every((choice) => choice.amount === choices[0]!.amount)) {
        const labels = choices.map((choice) => choice.label);
        const last = labels.pop();
        lines.push(`Gain ${choices[0]!.amount} ${labels.join(", ")}${labels.length > 1 ? "," : ""} or ${last}`);
        continue;
      }
      if (!effect.successEffects.length) throw new Error("Chance effect needs a success outcome");
      lines.push(
        `${Math.round(effect.probability * 100)}% chance: ${describeCardEffects(effect.successEffects).join("; ")}`,
      );
      if (effect.failureEffects.length)
        lines.push(`Otherwise: ${describeCardEffects(effect.failureEffects).join("; ")}`);
      continue;
    }
    if (effect.kind === "repeat-over-turns") {
      lines.push(
        ...describeCardEffects(effect.effects).map(
          (line) =>
            `${line} ${effect.remainingTurns === 1 ? "next turn" : `for the next ${effect.remainingTurns} turns`}`,
        ),
      );
      continue;
    }
    if (effect.kind === "random-draw" && effect.minAmount === 1 && effect.maxAmount === 6) {
      lines.push("Roll a six-sided die", "Draw that many cards");
      continue;
    }
    if (
      effect.kind === "self-damage" &&
      next?.kind === "cleanse-player-status-to-damage" &&
      effect.damageType === next.status
    ) {
      lines.push(`Receive ${effect.amount} ${capitalizeWord(effect.damageType)} damage`);
      continue;
    }
    if (effect.kind === "cleanse-player-status-to-damage") {
      lines.push(
        `Cleanse all ${capitalizeWord(effect.status)} on yourself`,
        `Deal ${capitalizeWord(effect.damageType)} damage equal to ${capitalizeWord(effect.status)} removed`,
      );
      continue;
    }
    if (
      effect.kind === "damage" &&
      effect.damageTypeIfTargetFrozen === effect.damageType &&
      effect.amountIfTargetFrozen === effect.amount * 2
    ) {
      lines.push(`Deal ${effect.amount} ${capitalizeWord(effect.damageType)} damage`, "Doubled against Frozen enemies");
    } else lines.push(effectDescriptionLine(effect));
    if (effect.kind === "damage") {
      if (effect.ignoreArmor || effect.ignoreBlock)
        lines.push(
          `Ignores ${[effect.ignoreArmor ? "Armor" : "", effect.ignoreBlock ? "Block" : ""].filter(Boolean).join(" and ")}`,
        );
      if (effect.doubleIfEnemyNotBurning) lines.push("Doubled if enemy was not Burning");
      if (effect.doubleIfEnemyBurning) lines.push("Doubled if the enemy was already Burning");
      if (effect.doubleIfEnemyBleeding) lines.push("Doubled if the enemy was already Bleeding");
      if (effect.tripleIfEnemyNotBurning) lines.push("Tripled if enemy was not Burning");
      if (effect.detonateAllBurn || effect.detonateIfEnemyBurning) lines.push("Detonate all Burn");
      if (effect.detonateAllBleed) lines.push("Detonate all Bleed");
    }
  }
  if (effects.some((effect) => effect.kind === "damage" && effect.lifesteal)) lines.push("Leech");
  return lines;
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
  if (!card.effects.length) return false;
  let expected: string[];
  try {
    expected = describeCardEffects(card.effects);
  } catch {
    return false;
  }
  if (card.tags) expected.push(...card.tags.map(capitalizeWord));
  if (card.consume) expected.push("Consume");
  return (
    expected.length === card.descriptionLines.length &&
    expected.every((line, index) => line === card.descriptionLines[index])
  );
}
