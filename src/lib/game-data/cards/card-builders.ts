import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import { capitalizeWord } from "@/lib/utils";
import { companionLibrary } from "../companions";
import { effectDescriptionLine } from "../effect-metadata";
import type { BattleCard, BattleCardEffect, DamageType, KeywordId } from "../types";
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

type DamageCardInput = CardBaseInput & {
  damageType: DamageType;
  amount: number;
  lifesteal?: boolean;
  tags?: KeywordId[];
};
export function damageCard({
  id,
  title,
  art,
  damageType,
  amount,
  cost = 1,
  lifesteal = false,
  tags,
}: DamageCardInput): BattleCard {
  const descriptionLines = [`Deal ${amount} ${capitalizeWord(damageType)} damage`];
  if (lifesteal) descriptionLines.push("Leech");
  if (tags) descriptionLines.push(...tags.map((tag) => capitalizeWord(tag)));
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines,
    art,
    cost,
    ...(tags ? { tags } : {}),
    effects: [{ kind: "damage", damageType, amount, ...(lifesteal ? { lifesteal: true } : {}) }],
  };
}

type PlayerStatusCardInput = CardBaseInput & { status: "block" | "armor" | "thorns" | "forge"; amount: number };
export function playerStatusCard({ id, title, art, status, amount, cost = 1 }: PlayerStatusCardInput): BattleCard {
  return {
    id,
    title: deriveTitle(id, title),
    descriptionLines: [effectDescriptionLine({ kind: "player-status", status, amount })],
    art,
    cost,
    effects: [{ kind: "player-status", status, amount }],
  };
}

type EffectsCardInput = CardBaseInput & {
  effects: BattleCardEffect[];
  tags?: KeywordId[];
  consume?: boolean;
  // Escape hatch for effects with no canonical line (chance,
  // repeat-over-turns, conditional or combined phrasing): replaces the
  // generated per-effect lines. Tags, Leech, and Consume are still appended.
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
  // One shared Leech line no matter how many hits drain.
  if (
    descriptionLines === undefined &&
    effects.some((effect) => effect.kind === "damage" && effect.lifesteal === true) &&
    !lines.includes("Leech")
  )
    lines.push("Leech");
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
