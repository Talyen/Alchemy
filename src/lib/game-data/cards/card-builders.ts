import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import { capitalizeWord } from "@/lib/utils";
import type { BattleCard, BattleCardEffect, DamageType, EnemyStatusDamageId, KeywordId } from "../types";
import { companionLibrary } from "../companions";
import { expectedCompanionTurnLine } from "./companion-turn-description";

interface CardBaseInput {
  id: BattleCard["id"];
  title?: string;
  art: BattleCard["art"];
  cost?: number;
}

function deriveTitle(id: string, customTitle?: string): string {
  if (customTitle) return customTitle;
  const base = id.endsWith("-companion") ? id.slice(0, -10) : id;
  return base.split("-").map(capitalizeWord).join(" ");
}

type PlayerStatusDescriptionStatus = "block" | "armor" | "thorns" | "forge";

function playerStatusDescriptionLine(status: PlayerStatusDescriptionStatus, amount: number): string {
  switch (status) {
    case "block":
      return `Gain ${amount} Block`;
    case "armor":
      return `Gain ${amount} Armor`;
    case "thorns":
      return `Gain ${amount} Thorns`;
    case "forge":
      return `Gain ${amount} Forge`;
  }
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
      return effect.removeAll
        ? "Remove all harmful status effects"
        : `Remove ${effect.amount} harmful status effect${effect.amount === 1 ? "" : "s"}`;
    case "player-status":
      if (
        effect.status === "block" ||
        effect.status === "armor" ||
        effect.status === "thorns" ||
        effect.status === "forge"
      )
        return playerStatusDescriptionLine(effect.status, effect.amount);
      throw new Error(`effectDescriptionLine: unsupported player-status ${effect.status}`);
    case "damage":
      if (effect.damageTypePool && effect.damageTypePool.length > 0) {
        const types = [...effect.damageTypePool].map(capitalizeWord);
        const last = types.pop();
        return `Deal ${effect.amount} ${types.join(", ")}, or ${last} damage`;
      }
      return `Deal ${effect.amount} ${capitalizeWord(effect.damageType)} damage`;
    case "gain-gold":
      return `Gain ${effect.amount} Gold`;
    case "wish":
      return `Wish ${effect.amount}`;
    case "remove-enemy-armor":
      return `Strip ${effect.amount} enemy Armor`;
    case "next-hit-crit":
      return "Your next damaging card is a critical strike";
    case "play-next-card-twice":
      return "Your next card is played twice";
    case "next-hit-poison":
      return "Your next attack is converted to Poison damage";
    case "next-archery-free":
      return "Your next Archery card is free";
    case "enemy-status":
    case "lose-mana":
    case "lose-max-mana":
    case "summon-companion":
    case "remove-player-status":
    case "self-damage":
    case "buff-companion":
    case "lose-health":
    case "draw-cards":
    case "multiply-enemy-status":
    case "cleanse-player-status-to-damage":
    case "random-damage":
    case "chance":
    case "repeat-over-turns":
      throw new Error(`effectDescriptionLine: unsupported effect kind ${(effect as BattleCardEffect).kind}`);
  }
}

type ArcheryDamageCardInput = CardBaseInput & { damageType: DamageType; amount: number };
export function archeryDamageCard({
  id,
  title,
  art,
  damageType,
  amount,
  cost = 1,
}: ArcheryDamageCardInput): BattleCard {
  const card = damageCard({ id, art, damageType, amount, cost, ...(title !== undefined ? { title } : {}) });
  return {
    ...card,
    descriptionLines: [...card.descriptionLines, "Archery"],
    tags: ["archery"],
  };
}

type DamageCardInput = CardBaseInput & { damageType: DamageType; amount: number; lifesteal?: boolean };
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
type DualDamageCardInput = CardBaseInput & { hits: [DamageHit, DamageHit] };
export function dualDamageCard({ id, title, art, hits, cost = 1 }: DualDamageCardInput): BattleCard {
  const [first, second] = hits;
  return effectsCard({
    id,
    ...(title !== undefined ? { title } : {}),
    art,
    cost,
    effects: [
      { kind: "damage", damageType: first.damageType, amount: first.amount },
      { kind: "damage", damageType: second.damageType, amount: second.amount },
    ],
  });
}

type PlayerStatusCardInput = CardBaseInput & { status: "block" | "armor" | "thorns" | "forge"; amount: number };
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

type SingleEffectCardInput = CardBaseInput & { effect: BattleCardEffect; descriptionLine?: string };
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

type ConsumableCardInput = CardBaseInput & { effect: BattleCardEffect };
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

type StatusThenEffectCardInput = CardBaseInput & {
  status: "block" | "armor" | "thorns";
  amount: number;
  effect: BattleCardEffect;
};
export function statusThenEffectCard({
  id,
  title,
  art,
  status,
  amount,
  effect,
  cost = 1,
}: StatusThenEffectCardInput): BattleCard {
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines: [playerStatusDescriptionLine(status, amount), effectDescriptionLine(effect)],
    art,
    cost,
    effects: [{ kind: "player-status", status, amount }, effect],
  };
}

type HealThenDamageCardInput = CardBaseInput & { heal: number; damageType: DamageType; damage: number };
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

type EffectsCardInput = CardBaseInput & { effects: BattleCardEffect[]; tags?: KeywordId[]; consume?: boolean };
export function effectsCard({
  id,
  title,
  art,
  effects,
  tags,
  consume = false,
  cost = 1,
}: EffectsCardInput): BattleCard {
  const lines = effects.map((effect) => effectDescriptionLine(effect));
  if (tags) lines.push(...tags.map((tag) => capitalizeWord(tag)));
  if (consume) lines.push(CONSUME_DESCRIPTION_LINE);
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines: lines,
    art,
    cost,
    ...(tags ? { tags } : {}),
    ...(consume ? { consume: true } : {}),
    effects,
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
  return { id, title: deriveTitle(id, title), descriptionLines, art, cost, effects };
}

type DamageThenMultiplyEnemyStatusCardInput = CardBaseInput & {
  damageType: DamageType;
  damageAmount: number;
  status: EnemyStatusDamageId;
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

type SummonCompanionCardInput = CardBaseInput & { companionId: import("../types").CompanionId };
export function summonCompanionCard({ id, title, art, companionId, cost = 1 }: SummonCompanionCardInput): BattleCard {
  const turnEffects = companionLibrary[companionId].turnStartEffects;
  if (turnEffects.length === 0)
    throw new Error(`Companion ${companionId} must have at least one turn-start effect for summon card ${id}`);
  const descriptionLines = turnEffects.map((effect) => expectedCompanionTurnLine(effect));
  descriptionLines.push("Companion");
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines,
    art,
    cost,
    consume: true,
    effects: [{ kind: "summon-companion", companionId }],
  };
}
