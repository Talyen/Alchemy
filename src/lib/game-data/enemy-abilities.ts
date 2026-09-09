import { cardById } from "./cards/library/cards";
import type { BattleCard, BattleCardEffect, BestiaryEntry } from "./types";

export type EnemyAbilityDamageEffect = Pick<
  Extract<BattleCardEffect, { kind: "damage" }>,
  "kind" | "damageType" | "amount" | "lifesteal" | "doubleIfEnemyBleeding"
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
      return hasOnlyFields(effect, ["kind", "damageType", "amount", "lifesteal", "doubleIfEnemyBleeding"]);
    case "player-status":
      return (
        ["block", "armor", "forge", "thorns"].includes(effect.status) &&
        hasOnlyFields(effect, ["kind", "status", "amount"])
      );
    case "heal":
    case "remove-enemy-armor":
      return hasOnlyFields(effect, ["kind", "amount"]);
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
    case "lose-health":
    case "draw-cards":
    case "cleanse-player-status-to-damage":
    case "random-damage":
    case "repeat-over-turns":
    case "next-hit-crit":
    case "play-next-card-twice":
    case "next-hit-poison":
    case "next-archery-free":
      return false;
  }
}

export function isEnemyAbilityCard(card: BattleCard): card is EnemyAbilityCard {
  return !card.consume && card.effects.length > 0 && card.effects.every(supportsEnemyEffect);
}

export function findEnemyAbilityCard(id: string): EnemyAbilityCard | undefined {
  if (!Object.hasOwn(cardById, id)) return undefined;
  const card = cardById[id];
  return card && isEnemyAbilityCard(card) ? card : undefined;
}

export function getEnemyAbilityCard(id: string): EnemyAbilityCard {
  const card = findEnemyAbilityCard(id);
  if (!card) throw new Error(`Unsupported enemy ability: ${id}`);
  return card;
}

export function getEnemyAbilities(enemy: Pick<BestiaryEntry, "abilityIds">): EnemyAbilityCard[] {
  return enemy.abilityIds.map(getEnemyAbilityCard);
}

export function enemyAbilityDealsDamage(card: Pick<BattleCard, "effects">): boolean {
  return card.effects.some(
    (effect) =>
      effect.kind === "damage" ||
      (effect.kind === "chance" &&
        (enemyAbilityDealsDamage({ effects: effect.successEffects }) ||
          enemyAbilityDealsDamage({ effects: effect.failureEffects }))),
  );
}
