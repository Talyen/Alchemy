// Player-facing card text after talents, homestead, and battle bonuses — shared by UI and tests.
import { capitalizeWord } from "@/lib/utils";
import { POTION_CARD_ID_SUFFIX } from "@/lib/game-constants";
import { formatCompanionTurnLineBase } from "./cards/companion-turn-description";
import { companionLibrary } from "./companions";
import type { BattleCard, BattleCardEffect, CompanionId } from "./types";

export interface CardDescriptionContext {
  flatPhysicalDamage?: number;
  companionDamage?: number;
  companionDamageBonus?: number;
  companionDamageBuff?: number;
  companionBondLevels?: Record<string, number>;
  potionPotency?: number;
}

function displayDamageType(type: string): string {
  return capitalizeWord(type);
}

function getPotionMultiplier(card: Pick<BattleCard, "id">, context: CardDescriptionContext): number {
  return card.id.endsWith(POTION_CARD_ID_SUFFIX) ? (context.potionPotency ?? 1) : 1;
}

function adjustedAmount(amount: number, multiplier: number): number {
  return Math.round(amount * multiplier);
}

function adjustedDamageAmount(
  effect: Extract<BattleCard["effects"][number], { kind: "damage" }>,
  context: CardDescriptionContext,
  potionMultiplier: number,
): number {
  const physicalBonus = effect.damageType === "physical" ? (context.flatPhysicalDamage ?? 0) : 0;
  return adjustedAmount(effect.amount, potionMultiplier) + physicalBonus;
}

function getSummonedCompanionId(card: Pick<BattleCard, "effects">): CompanionId | null {
  const effect = card.effects.find(
    (e): e is { kind: "summon-companion"; companionId: CompanionId } => e.kind === "summon-companion",
  );
  return effect?.companionId ?? null;
}

function isCompanionTurnLine(line: string): boolean {
  return (
    /^Deals \d+/.test(line) ||
    /^Restores \d+/.test(line) ||
    /^Cleanses \d+/.test(line) ||
    /^Steals \d+/.test(line) ||
    /^Gains? \d+ Block each turn/.test(line) ||
    /^Draws \d+/.test(line)
  );
}

function formatCompanionTurnStartLine(
  turnEffect: BattleCardEffect,
  context: { bondLevel?: number; damageBonus?: number } = {},
): string | null {
  if (turnEffect.kind === "damage") {
    const bondLevel = context.bondLevel ?? 0;
    const globalBonus = context.damageBonus ?? 0;
    return formatCompanionTurnLineBase(turnEffect, turnEffect.amount + bondLevel + globalBonus);
  }
  return formatCompanionTurnLineBase(turnEffect);
}

function getCompanionLine(card: Pick<BattleCard, "effects">, context: CardDescriptionContext): string | null {
  const companionId = getSummonedCompanionId(card);
  if (!companionId) return null;
  const companion = companionLibrary[companionId];
  const turnEffect = companion.turnStartEffects[0];
  if (!turnEffect) return null;

  return formatCompanionTurnStartLine(turnEffect, {
    bondLevel: context.companionBondLevels?.[companionId] ?? 0,
    damageBonus:
      (context.companionDamage ?? 0) + (context.companionDamageBonus ?? 0) + (context.companionDamageBuff ?? 0),
  });
}

type LineGetter<T> = () => T | undefined;

function createGetter<T>(array: T[]): () => T | undefined {
  let index = 0;
  return () => array[index++];
}

function processDealLine(
  line: string,
  getNext: LineGetter<Extract<BattleCard["effects"][number], { kind: "damage" }>>,
  context: CardDescriptionContext,
  potionMultiplier: number,
): string | null {
  if (!line.startsWith("Deal ")) return null;
  const effect = getNext();
  if (effect?.equalToBlock || effect?.equalToArmor || effect?.equalToGoldPercent) return line;
  return effect
    ? `Deal ${adjustedDamageAmount(effect, context, potionMultiplier)} ${displayDamageType(effect.damageType)} damage`
    : line;
}

function processGoldLine(
  line: string,
  getNext: LineGetter<{ amount: number }>,
  potionMultiplier: number,
): string | null {
  if (!line.startsWith("Gain ") || !line.includes(" Gold")) return null;
  const effect = getNext();
  return effect ? `Gain ${adjustedAmount(effect.amount, potionMultiplier)} Gold` : line;
}

function processStatusLine(
  line: string,
  getNext: LineGetter<Extract<BattleCard["effects"][number], { kind: "player-status" }>>,
  potionMultiplier: number,
): string | null {
  if (!line.startsWith("Gain ")) return null;
  const effect = getNext();
  if (effect?.perManaCrystal) return line;
  return effect ? `Gain ${adjustedAmount(effect.amount, potionMultiplier)} ${displayDamageType(effect.status)}` : line;
}

function processHealLine(
  line: string,
  getNext: LineGetter<{ amount: number }>,
  potionMultiplier: number,
): string | null {
  if (!line.startsWith("Heal ")) return null;
  const effect = getNext();
  return effect ? `Heal ${adjustedAmount(effect.amount, potionMultiplier)}` : line;
}

function processRestoreLine(
  line: string,
  getNext: LineGetter<{ amount: number }>,
  potionMultiplier: number,
): string | null {
  if (!line.startsWith("Restore ")) return null;
  const effect = getNext();
  return effect ? `Restore ${adjustedAmount(effect.amount, potionMultiplier)} Mana` : line;
}

function processWishLine(
  line: string,
  getNext: LineGetter<{ amount: number }>,
  potionMultiplier: number,
): string | null {
  if (!line.startsWith("Wish ")) return null;
  const effect = getNext();
  return effect ? `Wish ${adjustedAmount(effect.amount, potionMultiplier)}` : line;
}

function processRemoveLine(
  line: string,
  getNext: LineGetter<{ amount: number }>,
  potionMultiplier: number,
): string | null {
  if (!line.startsWith("Remove ")) return null;
  const effect = getNext();
  return effect
    ? `Remove ${adjustedAmount(effect.amount, potionMultiplier)} harmful Status${adjustedAmount(effect.amount, potionMultiplier) === 1 ? "" : "es"}`
    : line;
}

/** Returns description lines whose numbers match known mechanical bonuses. */
export function getEffectiveCardDescriptionLines(
  card: Pick<BattleCard, "id" | "effects" | "descriptionLines">,
  context: CardDescriptionContext = {},
): string[] {
  const potionMultiplier = getPotionMultiplier(card, context);
  const companionLine = getCompanionLine(card, context);
  const damageEffects = card.effects.filter(
    (effect): effect is Extract<BattleCard["effects"][number], { kind: "damage" }> => effect.kind === "damage",
  );
  const playerStatusEffects = card.effects.filter(
    (effect): effect is Extract<BattleCard["effects"][number], { kind: "player-status" }> =>
      effect.kind === "player-status",
  );
  const healEffects = card.effects.filter(
    (effect): effect is Extract<BattleCard["effects"][number], { kind: "heal" }> => effect.kind === "heal",
  );
  const manaEffects = card.effects.filter(
    (effect): effect is Extract<BattleCard["effects"][number], { kind: "restore-mana" }> =>
      effect.kind === "restore-mana",
  );
  const goldEffects = card.effects.filter(
    (effect): effect is Extract<BattleCard["effects"][number], { kind: "gain-gold" }> => effect.kind === "gain-gold",
  );
  const wishEffects = card.effects.filter(
    (effect): effect is Extract<BattleCard["effects"][number], { kind: "wish" }> => effect.kind === "wish",
  );
  const cleanseEffects = card.effects.filter(
    (effect): effect is Extract<BattleCard["effects"][number], { kind: "remove-harmful-status" }> =>
      effect.kind === "remove-harmful-status",
  );

  const getDamage = createGetter(damageEffects);
  const getGold = createGetter(goldEffects);
  const getStatus = createGetter(playerStatusEffects);
  const getHeal = createGetter(healEffects);
  const getMana = createGetter(manaEffects);
  const getWish = createGetter(wishEffects);
  const getCleanse = createGetter(cleanseEffects);

  return card.descriptionLines.map((line) => {
    if (companionLine && isCompanionTurnLine(line)) return companionLine;
    return (
      processDealLine(line, getDamage, context, potionMultiplier) ??
      processGoldLine(line, getGold, potionMultiplier) ??
      processStatusLine(line, getStatus, potionMultiplier) ??
      processHealLine(line, getHeal, potionMultiplier) ??
      processRestoreLine(line, getMana, potionMultiplier) ??
      processWishLine(line, getWish, potionMultiplier) ??
      processRemoveLine(line, getCleanse, potionMultiplier) ??
      line
    );
  });
}
