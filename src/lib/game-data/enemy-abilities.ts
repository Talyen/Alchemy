import { cardById } from "./cards/library/cards";
import type { BattleCard, BattleCardEffect, BestiaryEntry } from "./types";

// The runtime allowlist also defines the enemy damage contract, so accepting
// a hero field cannot silently leave the enemy resolver's type behind.
const ENEMY_DAMAGE_FIELDS = [
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
] as const satisfies ReadonlyArray<keyof Extract<BattleCardEffect, { kind: "damage" }>>;

export type EnemyAbilityDamageEffect = Pick<
  Extract<BattleCardEffect, { kind: "damage" }>,
  (typeof ENEMY_DAMAGE_FIELDS)[number]
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

function supportsEnemyLeaf(effect: BattleCardEffect): boolean {
  if (effect.kind === "damage") return hasOnlyFields(effect, ENEMY_DAMAGE_FIELDS);
  if (effect.kind === "player-status")
    return (
      ["block", "armor", "forge", "thorns"].includes(effect.status) &&
      hasOnlyFields(effect, ["kind", "status", "amount"])
    );
  if (effect.kind === "heal") return hasOnlyFields(effect, ["kind", "amount"]);
  if (effect.kind === "remove-enemy-armor") return hasOnlyFields(effect, ["kind", "amount", "removeAll", "halve"]);
  if (effect.kind === "multiply-enemy-status")
    return effect.status === "freeze" && hasOnlyFields(effect, ["kind", "status", "factor"]);
  return false;
}

interface EnemyEffectAnalysis {
  unsupported: BattleCardEffect | undefined;
  dealsDamage: boolean;
}

// Effect trees are immutable. Key by the tree itself, rather than the card or
// temporary branch wrappers: scaled/replaced trees get a fresh analysis.
const effectAnalysis = new WeakMap<readonly BattleCardEffect[], EnemyEffectAnalysis>();

function analyzeEffects(effects: readonly BattleCardEffect[]): EnemyEffectAnalysis {
  const cached = effectAnalysis.get(effects);
  if (cached) return cached;
  const result: EnemyEffectAnalysis = { unsupported: undefined, dealsDamage: false };
  for (const effect of effects) {
    if (effect.kind === "chance") {
      const success = analyzeEffects(effect.successEffects);
      const failure = analyzeEffects(effect.failureEffects);
      result.unsupported ??= success.unsupported ?? failure.unsupported;
      result.dealsDamage ||= success.dealsDamage || failure.dealsDamage;
    } else {
      if (!supportsEnemyLeaf(effect)) result.unsupported ??= effect;
      result.dealsDamage ||= effect.kind === "damage";
    }
  }
  effectAnalysis.set(effects, result);
  return result;
}

export function isEnemyAbilityCard(card: BattleCard): card is EnemyAbilityCard {
  return !card.consume && card.effects.length > 0 && !analyzeEffects(card.effects).unsupported;
}

export function findEnemyAbilityCard(id: string): EnemyAbilityCard | undefined {
  if (!Object.hasOwn(cardById, id)) return undefined;
  const card = cardById[id];
  return card && isEnemyAbilityCard(card) ? card : undefined;
}

export function getEnemyAbilityCard(id: string): EnemyAbilityCard {
  const card = findEnemyAbilityCard(id);
  if (!card) {
    const raw = Object.hasOwn(cardById, id) ? cardById[id] : undefined;
    throw new Error(`Unsupported enemy ability: ${id} (${describeEnemyAbilityProblem(raw)})`);
  }
  return card;
}

function describeEnemyAbilityProblem(card: BattleCard | undefined): string {
  if (!card || typeof card !== "object" || !Array.isArray(card.effects)) return "unknown card id";
  if (card.consume) return "consume cards cannot be enemy abilities";
  if (card.effects.length === 0) return "no effects";
  const bad = analyzeEffects(card.effects).unsupported;
  return bad
    ? `unsupported effect ${bad.kind} with fields [${Object.keys(bad).sort().join(",")}]`
    : "failed validation for unknown reason";
}

export function getEnemyAbilities(enemy: Pick<BestiaryEntry, "abilityIds">): EnemyAbilityCard[] {
  return enemy.abilityIds.map(getEnemyAbilityCard);
}

export function enemyAbilityDealsDamage(card: Pick<BattleCard, "effects">): boolean {
  return analyzeEffects(card.effects).dealsDamage;
}
