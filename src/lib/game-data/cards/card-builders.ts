// Small factories for repetitive BattleCard data shapes (companions, archery, etc.).
import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import { capitalizeWord } from "@/lib/utils";
import { companionLibrary } from "../companions";
import type { BattleCard, BattleCardEffect, CompanionId, DamageType, EnemyStatusId } from "../types";
import { expectedCompanionTurnLine } from "./companion-turn-description";

type CardBaseInput = {
  id: BattleCard["id"];
  title: string;
  art: BattleCard["art"];
  cost?: number;
};

type SummonCompanionCardInput = CardBaseInput & {
  companionId: CompanionId;
};

export function summonCompanionCard({ id, title, art, companionId, cost = 1 }: SummonCompanionCardInput): BattleCard {
  const turnEffects = companionLibrary[companionId].turnStartEffects;
  if (turnEffects.length !== 1) {
    throw new Error(
      `Companion ${companionId} must have exactly one turn-start effect for summon card ${id} (got ${turnEffects.length})`,
    );
  }
  const turnEffect = turnEffects[0]!;
  return {
    id,
    title,
    descriptionLines: [expectedCompanionTurnLine(turnEffect), "Companion"],
    art,
    cost,
    consume: true,
    effects: [{ kind: "summon-companion", companionId }],
  };
}

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
    title,
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
    title,
    descriptionLines,
    art,
    cost,
    effects: [{ kind: "damage", damageType, amount, ...(lifesteal ? { lifesteal: true } : {}) }],
  };
}

type DamageHit = { damageType: DamageType; amount: number };

type DualDamageCardInput = CardBaseInput & {
  hits: [DamageHit, DamageHit];
};

export function dualDamageCard({ id, title, art, hits, cost = 1 }: DualDamageCardInput): BattleCard {
  const [first, second] = hits;
  return {
    id,
    title,
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

function playerStatusDescriptionLine(status: PlayerStatusCardInput["status"], amount: number): string {
  switch (status) {
    case "block":
      return `Gain ${amount} Block`;
    case "armor":
      return `Gain ${amount} Armor`;
    case "forge":
      return `Gain ${amount} Forge`;
  }
}

export function playerStatusCard({ id, title, art, status, amount, cost = 1 }: PlayerStatusCardInput): BattleCard {
  return {
    id,
    title,
    descriptionLines: [playerStatusDescriptionLine(status, amount)],
    art,
    cost,
    effects: [{ kind: "player-status", status, amount }],
  };
}

function effectDescriptionLine(effect: BattleCardEffect): string {
  switch (effect.kind) {
    case "heal":
      return `Restore ${effect.amount} Health`;
    case "restore-mana":
      return `Restore ${effect.amount} Mana`;
    case "gain-max-mana":
      return `Gain ${effect.amount} Maximum Mana`;
    case "remove-harmful-status":
      return `Remove ${effect.amount} harmful status effect`;
    case "player-status":
      if (effect.status === "block" || effect.status === "armor" || effect.status === "forge") {
        return playerStatusDescriptionLine(effect.status, effect.amount);
      }
      break;
    case "damage":
      return `Deal ${effect.amount} ${capitalizeWord(effect.damageType)} damage`;
    case "gain-gold":
      return `Gain ${effect.amount} Gold`;
    case "wish":
      return `Wish ${effect.amount}`;
    default:
      break;
  }
  throw new Error(`effectDescriptionLine: unsupported effect kind ${(effect as { kind: string }).kind}`);
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
    title,
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
    title,
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
    title,
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
    title,
    descriptionLines: [`Restore ${heal} Health`, `Deal ${damage} ${capitalizeWord(damageType)} damage`],
    art,
    cost,
    effects: [
      { kind: "heal", amount: heal },
      { kind: "damage", damageType, amount: damage },
    ],
  };
}

type ScaleFromPlayerStat = "block" | "armor";

type PlayerStatThenScaledDamageCardInput = CardBaseInput & {
  damageType: DamageType;
  scaleFrom: ScaleFromPlayerStat;
  playerStat?: { status: ScaleFromPlayerStat; amount: number };
};

function scaledDamageFromStatLine(damageType: DamageType, scaleFrom: ScaleFromPlayerStat): string {
  const stat = scaleFrom === "block" ? "Block" : "Armor";
  return `Deal ${capitalizeWord(damageType)} damage equal to your ${stat}`;
}

export function playerStatThenScaledDamageCard({
  id,
  title,
  art,
  damageType,
  scaleFrom,
  playerStat,
  cost = 1,
}: PlayerStatThenScaledDamageCardInput): BattleCard {
  const descriptionLines: string[] = [];
  const effects: BattleCardEffect[] = [];
  if (playerStat) {
    descriptionLines.push(playerStatusDescriptionLine(playerStat.status, playerStat.amount));
    effects.push({ kind: "player-status", status: playerStat.status, amount: playerStat.amount });
  }
  descriptionLines.push(scaledDamageFromStatLine(damageType, scaleFrom));
  effects.push({
    kind: "damage",
    damageType,
    amount: 0,
    ...(scaleFrom === "block" ? { equalToBlock: true } : { equalToArmor: true }),
  });
  return { id, title, descriptionLines, art, cost, effects };
}

type DamageThenMultiplyEnemyStatusCardInput = CardBaseInput & {
  damageType: DamageType;
  damageAmount: number;
  status: EnemyStatusId;
  factor: number;
  multiplyLine: string;
  consume?: boolean;
};

export function damageThenMultiplyEnemyStatusCard({
  id,
  title,
  art,
  damageType,
  damageAmount,
  status,
  factor,
  multiplyLine,
  consume = false,
  cost = 1,
}: DamageThenMultiplyEnemyStatusCardInput): BattleCard {
  const descriptionLines = [
    `Deal ${damageAmount} ${capitalizeWord(damageType)} damage`,
    multiplyLine,
    ...(consume ? [CONSUME_DESCRIPTION_LINE] : []),
  ];
  return {
    id,
    title,
    descriptionLines,
    art,
    cost,
    ...(consume ? { consume: true } : {}),
    effects: [
      { kind: "damage", damageType, amount: damageAmount },
      { kind: "multiply-enemy-status", status, factor },
    ],
  };
}

type CleansePlayerStatusCardInput = CardBaseInput & {
  status: EnemyStatusId;
  cleanseLine: string;
  consume?: boolean;
};

export function cleansePlayerStatusCard({
  id,
  title,
  art,
  status,
  cleanseLine,
  consume = false,
  cost = 1,
}: CleansePlayerStatusCardInput): BattleCard {
  const descriptionLines = [...(consume ? [cleanseLine, CONSUME_DESCRIPTION_LINE] : [cleanseLine])];
  return {
    id,
    title,
    descriptionLines,
    art,
    cost,
    ...(consume ? { consume: true } : {}),
    effects: [{ kind: "remove-player-status", status }],
  };
}
