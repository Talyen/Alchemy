import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import { capitalizeWord } from "@/lib/utils";
import { companionLibrary } from "../companions";
import { createEffectDescription } from "../effect-metadata";
import { mapCardDescriptionReferences, withCardDescription, type CardDescription } from "../card-description-model";
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
export function damageCard({ damageType, amount, lifesteal = false, ...base }: DamageCardInput): BattleCard {
  return effectsCard({
    ...base,
    effects: [{ kind: "damage", damageType, amount, ...(lifesteal ? { lifesteal: true } : {}) }],
  });
}

type PlayerStatusCardInput = CardBaseInput & { status: "block" | "armor" | "thorns" | "forge"; amount: number };
export function playerStatusCard({ status, amount, ...base }: PlayerStatusCardInput): BattleCard {
  return effectsCard({
    ...base,
    effects: [{ kind: "player-status", status, amount }],
  });
}

type EffectsCardInput<E extends BattleCardEffect[]> = CardBaseInput & {
  effects: E;
  describe?: (effects: E) => CardDescription;
  tags?: KeywordId[];
  consume?: boolean;
};
export function effectsCard<const E extends BattleCardEffect[]>({
  id,
  title,
  art,
  effects,
  tags,
  consume = false,
  describe,
  cost = 1,
}: EffectsCardInput<E>): BattleCard {
  const description = mapCardDescriptionReferences(
    describe ? describe(effects) : createEffectDescription(effects),
    (reference) => reference,
  );
  if (tags) description.push(...tags.map((tag) => ({ parts: [capitalizeWord(tag)], role: "keyword" as const })));
  if (consume) description.push({ parts: [CONSUME_DESCRIPTION_LINE], role: "consume" });
  return withCardDescription(
    {
      id,
      title: deriveTitle(id, title),
      descriptionLines: [],
      art,
      cost,
      ...(tags ? { tags } : {}),
      ...(consume ? { consume: true } : {}),
      effects,
    },
    description,
  );
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
    description: descriptionLines.map((line, index) => ({
      parts: [line],
      role: index === descriptionLines.length - 1 ? "keyword" : "effect",
    })),
    art,
    cost,
    consume: true,
    effects: [{ kind: "summon-companion", companionId }],
  };
}
