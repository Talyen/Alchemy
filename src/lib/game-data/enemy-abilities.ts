import { cardById } from "./cards/library/cards";
import type { BattleCard, BattleCardEffect, BestiaryEntry } from "./types";

export type EnemyAbilityDamageEffect = Pick<
  Extract<BattleCardEffect, { kind: "damage" }>,
  | "kind"
  | "damageType"
  | "damageTypePool"
  | "amount"
  | "lifesteal"
  | "doubleIfEnemyBleeding"
  | "equalToBlock"
  | "equalToBlockPercent"
  | "equalToForge"
  | "ignoreArmor"
  | "ignoreBlock"
  | "blockCost"
  | "blockDamageBonus"
  | "damageTypeIfTargetHasBlock"
  | "damageTypeIfTargetFrozen"
  | "amountIfTargetFrozen"
>;

export type EnemyAbilityEffect =
  | EnemyAbilityDamageEffect
  | { kind: "player-status"; status: "block" | "armor" | "forge" | "thorns"; amount: number }
  | Extract<BattleCardEffect, { kind: "heal" | "remove-enemy-armor" }>
  | { kind: "multiply-enemy-status"; status: "freeze"; factor: number }
  | {
      kind: "chance";
      probability: number;
      successEffects: EnemyAbilityEffect[];
      failureEffects: EnemyAbilityEffect[];
    };

export type EnemyAbilityCard = Omit<BattleCard, "effects"> & { effects: EnemyAbilityEffect[] };

function hasOnlyFields(effect: BattleCardEffect, fields: readonly string[]): boolean {
  return Object.keys(effect).every((field) => fields.includes(field));
}

function supportsEnemyEffect(effect: BattleCardEffect): effect is EnemyAbilityEffect {
  switch (effect.kind) {
    case "damage":
      return hasOnlyFields(effect, [
        "kind",
        "damageType",
        "damageTypePool",
        "amount",
        "lifesteal",
        "doubleIfEnemyBleeding",
        "equalToBlock",
        "equalToBlockPercent",
        "equalToForge",
        "ignoreArmor",
        "ignoreBlock",
        "blockCost",
        "blockDamageBonus",
        "damageTypeIfTargetHasBlock",
        "damageTypeIfTargetFrozen",
        "amountIfTargetFrozen",
      ]);
    case "player-status":
      return (
        ["block", "armor", "forge", "thorns"].includes(effect.status) &&
        hasOnlyFields(effect, ["kind", "status", "amount"])
      );
    case "heal":
      return hasOnlyFields(effect, ["kind", "amount"]);
    case "remove-enemy-armor":
      return hasOnlyFields(effect, ["kind", "amount", "removeAll", "halve"]);
    case "multiply-enemy-status":
      return effect.status === "freeze" && hasOnlyFields(effect, ["kind", "status", "factor"]);
    case "chance":
      return effect.successEffects.every(supportsEnemyEffect) && effect.failureEffects.every(supportsEnemyEffect);
    case "wish":
    case "enemy-status":
    case "restore-mana":
    case "lose-mana":
    case "lose-max-mana":
    case "gain-max-mana":
    case "gain-gold":
    case "summon-companion":
    case "remove-harmful-status":
    case "remove-player-status":
    case "self-damage":
    case "buff-companion":
    case "companion-action":
    case "random-draw":
    case "lose-health":
    case "draw-cards":
    case "cleanse-player-status-to-damage":
    case "random-damage":
    case "repeat-over-turns":
    case "next-hit-crit":
    case "next-hit-leech":
    case "play-next-card-twice":
    case "next-hit-poison":
    case "next-archery-free":
      return false;
  }
}

const ENEMY_ABILITY_CARD_VALIDITY_CACHE = new WeakMap<BattleCard, boolean>();
const ENEMY_ABILITY_CARD_BY_ID_CACHE = new Map<string, EnemyAbilityCard | undefined>();
const ENEMY_ABILITY_DEALS_DAMAGE_CACHE = new WeakMap<object, boolean>();

export function isEnemyAbilityCard(card: BattleCard): card is EnemyAbilityCard {
  const cached = ENEMY_ABILITY_CARD_VALIDITY_CACHE.get(card);
  if (cached !== undefined) return cached;

  const valid = !card.consume && card.effects.length > 0 && card.effects.every(supportsEnemyEffect);
  ENEMY_ABILITY_CARD_VALIDITY_CACHE.set(card, valid);
  return valid;
}

export function findEnemyAbilityCard(id: string): EnemyAbilityCard | undefined {
  if (ENEMY_ABILITY_CARD_BY_ID_CACHE.has(id)) {
    return ENEMY_ABILITY_CARD_BY_ID_CACHE.get(id);
  }

  if (!Object.hasOwn(cardById, id)) {
    ENEMY_ABILITY_CARD_BY_ID_CACHE.set(id, undefined);
    return undefined;
  }
  const card = cardById[id];
  const result = card && isEnemyAbilityCard(card) ? card : undefined;
  ENEMY_ABILITY_CARD_BY_ID_CACHE.set(id, result);
  return result;
}

export function getEnemyAbilityCard(id: string): EnemyAbilityCard {
  const card = findEnemyAbilityCard(id);
  if (!card) {
    const raw = Object.hasOwn(cardById, id) ? cardById[id] : undefined;
    throw new Error(`Unsupported enemy ability: ${id} (${describeEnemyAbilityProblem(raw)})`);
  }
  return card;
}

function describeUnsupportedEffect(effect: BattleCardEffect): string | undefined {
  if (supportsEnemyEffect(effect)) return undefined;
  if (effect.kind === "chance") {
    const bad =
      effect.successEffects.map(describeUnsupportedEffect).find(Boolean) ??
      effect.failureEffects.map(describeUnsupportedEffect).find(Boolean);
    return bad ?? `chance with unsupported branch in ${JSON.stringify(Object.keys(effect))}`;
  }
  return `${effect.kind} with fields [${Object.keys(effect).sort().join(",")}]`;
}

function describeEnemyAbilityProblem(card: BattleCard | undefined): string {
  if (!card || typeof card !== "object" || !Array.isArray(card.effects)) return "unknown card id";
  if (card.consume) return "consume cards cannot be enemy abilities";
  if (card.effects.length === 0) return "no effects";
  const bad = card.effects.map(describeUnsupportedEffect).find(Boolean);
  return bad ? `unsupported effect ${bad}` : "failed validation for unknown reason";
}

export function getEnemyAbilities(enemy: Pick<BestiaryEntry, "abilityIds">): EnemyAbilityCard[] {
  return enemy.abilityIds.map(getEnemyAbilityCard);
}

export function enemyAbilityDealsDamage(card: Pick<BattleCard, "effects">): boolean {
  const cached = ENEMY_ABILITY_DEALS_DAMAGE_CACHE.get(card);
  if (cached !== undefined) return cached;

  const dealsDamage = card.effects.some(
    (effect) =>
      effect.kind === "damage" ||
      (effect.kind === "chance" &&
        (enemyAbilityDealsDamage({ effects: effect.successEffects }) ||
          enemyAbilityDealsDamage({ effects: effect.failureEffects }))),
  );
  ENEMY_ABILITY_DEALS_DAMAGE_CACHE.set(card, dealsDamage);
  return dealsDamage;
}
