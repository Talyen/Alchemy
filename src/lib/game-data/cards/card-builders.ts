import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import { capitalizeWord } from "@/lib/utils";
import type { BattleCard, BattleCardEffect, DamageType, KeywordId } from "../types";
import { companionLibrary } from "../companions";
import { getCompanionDescriptionLines } from "./companion-turn-description";

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
  return `Gain ${amount} ${capitalizeWord(status)}`;
}

function effectDescriptionLine(effect: BattleCardEffect): string {
  switch (effect.kind) {
    case "heal":
      return `Restore ${effect.amount} Health`;
    case "restore-mana":
      return `Gain ${effect.amount} Mana`;
    case "gain-max-mana":
      return `Gain ${effect.amount} Mana Crystal${effect.amount === 1 ? "" : "s"}`;
    case "remove-harmful-status": {
      if (effect.removeAll) return "Cleanse all harmful status effects";
      if (effect.amount === undefined)
        throw new Error("effectDescriptionLine: remove-harmful-status needs amount without removeAll");
      return `Cleanse ${effect.amount} harmful status effect${effect.amount === 1 ? "" : "s"}`;
    }
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
    case "draw-cards":
      return effect.amount === 1 ? "Draw a card" : `Draw ${effect.amount} cards`;
    case "lose-health":
      return `Lose ${effect.amount} Health`;
    case "lose-mana":
      return `Lose ${effect.amount} Mana`;
    case "lose-max-mana":
      return `Lose ${effect.amount} Mana Crystal${effect.amount === 1 ? "" : "s"}`;
    case "self-damage":
      return `Take ${effect.amount} ${capitalizeWord(effect.damageType)} damage`;
    case "random-damage":
      return `Deal ${effect.minAmount}–${effect.maxAmount} Random damage`;
    case "wish":
      return `Wish ${effect.amount}`;
    case "remove-enemy-armor": {
      if (effect.removeAll) return "Remove all enemy Armor";
      if (effect.amount === undefined)
        throw new Error("effectDescriptionLine: remove-enemy-armor needs amount without removeAll");
      return `Remove ${effect.amount} enemy Armor`;
    }
    case "next-hit-crit":
      return "Your next damaging card is a critical strike";
    case "next-hit-leech":
      return "Your next damaging card has Leech";
    case "play-next-card-twice":
      return "Your next card is played twice";
    case "next-hit-poison":
      return "Your next attack is converted to Poison damage";
    case "next-archery-free":
      return "Your next Archery card is free";
    case "enemy-status":
    case "summon-companion":
    case "remove-player-status":
    case "buff-companion":
    case "companion-action":
    case "random-draw":
    case "multiply-enemy-status":
    case "cleanse-player-status-to-damage":
    case "chance":
    case "repeat-over-turns":
      throw new Error(`effectDescriptionLine: unsupported effect kind ${(effect as BattleCardEffect).kind}`);
  }
}

type ArcheryDamageCardInput = CardBaseInput & { damageType: DamageType; amount: number; lifesteal?: boolean };
export function archeryDamageCard({
  id,
  title,
  art,
  damageType,
  amount,
  lifesteal = false,
  cost = 1,
}: ArcheryDamageCardInput): BattleCard {
  const card = damageCard({ id, art, damageType, amount, lifesteal, cost, ...(title !== undefined ? { title } : {}) });
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
  lifesteal?: boolean;
}
type DualDamageCardInput = CardBaseInput & { hits: [DamageHit, DamageHit] };
export function dualDamageCard({ id, title, art, hits, cost = 1 }: DualDamageCardInput): BattleCard {
  const [first, second] = hits;
  const card = effectsCard({
    id,
    ...(title !== undefined ? { title } : {}),
    art,
    cost,
    effects: [
      {
        kind: "damage",
        damageType: first.damageType,
        amount: first.amount,
        ...(first.lifesteal ? { lifesteal: true } : {}),
      },
      {
        kind: "damage",
        damageType: second.damageType,
        amount: second.amount,
        ...(second.lifesteal ? { lifesteal: true } : {}),
      },
    ],
  });
  // One shared Leech line no matter how many hits drain.
  if ((first.lifesteal ?? false) || (second.lifesteal ?? false)) card.descriptionLines.push("Leech");
  return card;
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

type ConsumableCardInput = CardBaseInput & {
  effect?: BattleCardEffect;
  effects?: BattleCardEffect[];
  descriptionLines?: string[];
};
export function consumableCard({
  id,
  title,
  art,
  effect,
  effects,
  descriptionLines,
  cost = 1,
}: ConsumableCardInput): BattleCard {
  const resolved = effects ?? (effect ? [effect] : []);
  if (resolved.length === 0) throw new Error(`consumableCard ${id} needs effect or effects`);
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines: [
      ...(descriptionLines ?? resolved.map((item) => effectDescriptionLine(item))),
      CONSUME_DESCRIPTION_LINE,
    ],
    art,
    cost,
    consume: true,
    effects: resolved,
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
    descriptionLines.push(draw === 1 ? "Draw a card" : `Draw ${draw} cards`);
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

type EffectsCardInput = CardBaseInput & {
  effects: BattleCardEffect[];
  tags?: KeywordId[];
  consume?: boolean;
  // Escape hatch for effects with no canonical line (chance,
  // repeat-over-turns, conditional or combined phrasing): replaces the
  // generated per-effect lines. Tags and Consume are still appended.
  descriptionLines?: string[];
};
export function effectsCard({
  id,
  title,
  art,
  effects,
  tags,
  consume = false,
  descriptionLines,
  cost = 1,
}: EffectsCardInput): BattleCard {
  const lines = [...(descriptionLines ?? effects.map((effect) => effectDescriptionLine(effect)))];
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

type SummonCompanionCardInput = CardBaseInput & { companionId: import("../types").CompanionId };
export function summonCompanionCard({ id, title, art, companionId, cost = 1 }: SummonCompanionCardInput): BattleCard {
  const companion = companionLibrary[companionId];
  const turnEffects = companion.turnStartEffects;
  if (turnEffects.length === 0)
    throw new Error(`Companion ${companionId} must have at least one turn-start effect for summon card ${id}`);
  const descriptionLines = getCompanionDescriptionLines(companion);
  descriptionLines.push("Companion");
  // Companion names (including "Risen Skeleton" and "Will-o'-Wisp") come from
  // the companion definition — never from capitalizing the card id.
  const companionTitle = companion.title.endsWith(" Companion")
    ? companion.title.slice(0, -" Companion".length)
    : undefined;
  return {
    id,
    title: title ?? companionTitle ?? deriveTitle(id),
    descriptionLines,
    art,
    cost,
    consume: true,
    effects: [{ kind: "summon-companion", companionId }],
  };
}
