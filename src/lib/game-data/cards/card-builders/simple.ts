import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import { capitalizeWord } from "@/lib/utils";
import type { BattleCard, BattleCardEffect, DamageType } from "../../types";
import { deriveTitle, effectDescriptionLine, playerStatusDescriptionLine, type CardBaseInput } from "./shared";

type ArcheryDamageCardInput = CardBaseInput & {
  damageType: DamageType;
  amount: number;
};

export function archeryDamageCard({
  id,
  title,
  art,
  damageType,
  amount,
  cost = 1,
}: ArcheryDamageCardInput): BattleCard {
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines: [`Deal ${amount} ${capitalizeWord(damageType)} damage`, "Archery"],
    art,
    cost,
    tags: ["archery"],
    effects: [{ kind: "damage", damageType, amount }],
  };
}

type DamageCardInput = CardBaseInput & {
  damageType: DamageType;
  amount: number;
  lifesteal?: boolean;
};

export function damageCard({
  id,
  title,
  art,
  damageType,
  amount,
  cost = 1,
  lifesteal = false,
}: DamageCardInput): BattleCard {
  const descriptionLines = [`Deal ${amount} ${capitalizeWord(damageType)} damage`];
  if (lifesteal) descriptionLines.push("Leech");
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines,
    art,
    cost,
    effects: [{ kind: "damage", damageType, amount, ...(lifesteal ? { lifesteal: true } : {}) }],
  };
}

interface DamageHit {
  damageType: DamageType;
  amount: number;
}

type DualDamageCardInput = CardBaseInput & {
  hits: [DamageHit, DamageHit];
};

export function dualDamageCard({ id, title, art, hits, cost = 1 }: DualDamageCardInput): BattleCard {
  const [first, second] = hits;
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines: [
      `Deal ${first.amount} ${capitalizeWord(first.damageType)} damage`,
      `Deal ${second.amount} ${capitalizeWord(second.damageType)} damage`,
    ],
    art,
    cost,
    effects: [
      { kind: "damage", damageType: first.damageType, amount: first.amount },
      { kind: "damage", damageType: second.damageType, amount: second.amount },
    ],
  };
}

type PlayerStatusCardInput = CardBaseInput & {
  status: "block" | "armor" | "forge";
  amount: number;
};

export function playerStatusCard({ id, title, art, status, amount, cost = 1 }: PlayerStatusCardInput): BattleCard {
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines: [playerStatusDescriptionLine(status, amount)],
    art,
    cost,
    effects: [{ kind: "player-status", status, amount }],
  };
}

type SingleEffectCardInput = CardBaseInput & {
  effect: BattleCardEffect;
  descriptionLine?: string;
};

export function singleEffectCard({
  id,
  title,
  art,
  effect,
  descriptionLine,
  cost = 1,
}: SingleEffectCardInput): BattleCard {
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines: [descriptionLine ?? effectDescriptionLine(effect)],
    art,
    cost,
    effects: [effect],
  };
}

type ConsumableCardInput = CardBaseInput & {
  effect: BattleCardEffect;
};

export function consumableCard({ id, title, art, effect, cost = 1 }: ConsumableCardInput): BattleCard {
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines: [effectDescriptionLine(effect), CONSUME_DESCRIPTION_LINE],
    art,
    cost,
    consume: true,
    effects: [effect],
  };
}

type LoseHealthBenefitCardInput = CardBaseInput & {
  healthLoss: number;
  wish?: number;
  draw?: number;
  consume?: boolean;
};

export function loseHealthBenefitCard({
  id,
  title,
  art,
  healthLoss,
  wish,
  draw,
  consume = false,
  cost = 1,
}: LoseHealthBenefitCardInput): BattleCard {
  const descriptionLines = [`Lose ${healthLoss} Health`];
  const effects: BattleCardEffect[] = [{ kind: "lose-health", amount: healthLoss }];
  if (wish !== undefined) {
    descriptionLines.push(`Wish ${wish}`);
    effects.push({ kind: "wish", amount: wish });
  }
  if (draw !== undefined) {
    descriptionLines.push(`Draw ${draw} Card${draw === 1 ? "" : "s"}`);
    effects.push({ kind: "draw-cards", amount: draw });
  }
  if (consume) descriptionLines.push(CONSUME_DESCRIPTION_LINE);
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines,
    art,
    cost,
    ...(consume ? { consume: true } : {}),
    effects,
  };
}

type HealThenDamageCardInput = CardBaseInput & {
  heal: number;
  damageType: DamageType;
  damage: number;
};

export function healThenDamageCard({
  id,
  title,
  art,
  heal,
  damageType,
  damage,
  cost = 1,
}: HealThenDamageCardInput): BattleCard {
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines: [`Restore ${heal} Health`, `Deal ${damage} ${capitalizeWord(damageType)} damage`],
    art,
    cost,
    effects: [
      { kind: "heal", amount: heal },
      { kind: "damage", damageType, amount: damage },
    ],
  };
}
