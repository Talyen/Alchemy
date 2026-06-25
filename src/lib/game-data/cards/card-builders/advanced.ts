import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import { capitalizeWord } from "@/lib/utils";
import type { BattleCard, BattleCardEffect, DamageType, EnemyStatusId } from "../../types";
import { deriveTitle, playerStatusDescriptionLine, type CardBaseInput } from "./shared";

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
  return { id, title: deriveTitle(id, title), descriptionLines, art, cost, effects };
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
    title: deriveTitle(id, title),
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
    title: deriveTitle(id, title),
    descriptionLines,
    art,
    cost,
    ...(consume ? { consume: true } : {}),
    effects: [{ kind: "remove-player-status", status }],
  };
}
