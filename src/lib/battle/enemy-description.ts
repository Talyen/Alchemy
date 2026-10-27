import {
  getCardDescription,
  getCardEffect,
  renderCardDescription,
  type BattleCard,
  type EnemyTrait,
  type EnemyAbilityEffect,
  type EnemyAbilityCard,
} from "@/lib/game-data";
import {
  ENEMY_STARTING_BLOCK,
  LIVING_ARMOR_STARTING_ARMOR,
  ENEMY_BASE_REGENERATION,
  ENEMY_BOSS_REGENERATION,
} from "../game-constants";
import { scaleEnemyAbilityDamage } from "./battle-enemy-setup";
import { capitalizeWord } from "../utils";
import type { BattleState } from "./types";

export type EnemyDescriptionContext = Readonly<
  Pick<BattleState, "roomScalingMultiplier" | "difficultyModifiers" | "currentEnemy">
>;

function scaleEffect(effect: EnemyAbilityEffect, context: EnemyDescriptionContext): EnemyAbilityEffect {
  const room = (amount: number) => Math.round(amount * context.roomScalingMultiplier);
  switch (effect.kind) {
    case "chance":
      return {
        ...effect,
        successEffects: effect.successEffects.map((e) => scaleEffect(e, context)),
        failureEffects: effect.failureEffects.map((e) => scaleEffect(e, context)),
      };
    case "damage": {
      if (effect.equalToBlock) return { ...scaleEnemyAbilityDamage(context, effect, true), amount: effect.amount };
      const damage = (amount: number, damageType = effect.damageType) =>
        scaleEnemyAbilityDamage(context, { ...effect, amount, damageType }).amount;
      return {
        ...effect,
        ...scaleEnemyAbilityDamage(context, effect),
        ...(effect.amountIfTargetFrozen !== undefined
          ? { amountIfTargetFrozen: damage(effect.amountIfTargetFrozen, effect.damageTypeIfTargetFrozen) }
          : {}),
      };
    }
    case "heal":
    case "player-status":
      return { ...effect, amount: room(effect.amount) };
    case "remove-enemy-armor":
      return effect.amount !== undefined && !effect.halve && !effect.removeAll
        ? { ...effect, amount: room(effect.amount) }
        : effect;
    case "multiply-enemy-status":
      return effect;
  }
}

/** Presentation copies must never be passed back into ability resolution. */
export function getEncounterEnemyAbility(card: EnemyAbilityCard, context: EnemyDescriptionContext): BattleCard {
  const effects = card.effects.map((effect) => scaleEffect(effect, context));
  const { description: _authoredDescription, ...presentation } = card;
  const description = getCardDescription({ ...presentation, effects });
  // A damage-type alternative can receive different flat difficulty bonuses.
  for (const line of description) {
    line.parts = line.parts.map((part, index) => {
      if (typeof part === "string") return part;
      const reference = part.references[0];
      if (!reference || reference.kind !== "damage" || reference.field !== "amount") return part;
      const original = getCardEffect(card.effects, reference);
      if (original?.kind !== "damage") return part;
      const damage = (damageType: typeof original.damageType) =>
        scaleEnemyAbilityDamage(context, { ...original, damageType }).amount;
      if (original.damageTypePool?.length) {
        const amounts = original.damageTypePool.map(damage);
        if (new Set(amounts).size > 1) {
          // The structured damage line places its type label immediately after its magnitude.
          line.parts[index + 1] = " damage";
          return original.damageTypePool.map((type, i) => `${amounts[i]} ${capitalizeWord(type)}`).join(" or ");
        }
      }
      return part;
    });
  }

  return {
    ...card,
    effects,
    description,
    descriptionLines: renderCardDescription(effects, description).descriptionLines,
  };
}

const ROOM_SCALED_TRAITS = new Set([
  "cinder-skin",
  "frost-elemental",
  "pyromancer",
  "dire-wolf",
  "blood-cultist",
  "tempered",
  "plated",
  "reinforced",
  "septic",
  "caustic",
  "flesheater",
  "combustible",
  "chilling",
  "zealot",
  "insatiable",
  "jealous",
  "concussive",
  "rooted",
  "overgrowth",
  "holy-retribution",
  "toxic",
  "bloodletter",
]);

function scaleTraitNumbers(description: string, room: (amount: number) => number): string {
  // Percentages are thresholds, not room-scaled magnitudes.
  return description.replace(/\b\d+\b(?!%)/g, (value) => String(room(Number(value))));
}

const TRAIT_DESCRIPTION_SCALERS: Record<
  string,
  (description: string, room: (n: number) => number, context: EnemyDescriptionContext) => string
> = {
  "starting-block": (_description, room) => `Starts with ${room(ENEMY_STARTING_BLOCK)} Block`,
  "living-armor": (description, room) => description.replace("4 Armor", `${room(LIVING_ARMOR_STARTING_ARMOR)} Armor`),
  regeneration: (_description, room, context) =>
    `Restores ${room(context.currentEnemy.enemyType === "boss" ? ENEMY_BOSS_REGENERATION : ENEMY_BASE_REGENERATION)} Health each turn.`,
  "stone-golem": (description, room) => description.replace("1 additional", `${room(1)} additional`),
  thorns: (description, room) => description.replace("deals 1 Physical", `deals ${room(1)} Physical`),
  "divine-aegis": (description, room) =>
    description.replace("2 Armor and 4 Block", `${room(2)} Armor and ${room(4)} Block`),
};

export function getEncounterEnemyTrait(trait: EnemyTrait, context: EnemyDescriptionContext): EnemyTrait {
  const room = (amount: number) => Math.round(amount * context.roomScalingMultiplier);
  const scaler = TRAIT_DESCRIPTION_SCALERS[trait.id];
  const description = scaler
    ? scaler(trait.description, room, context)
    : ROOM_SCALED_TRAITS.has(trait.id)
      ? scaleTraitNumbers(trait.description, room)
      : trait.description;
  return description === trait.description ? trait : { ...trait, description };
}
