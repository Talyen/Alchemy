import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";
import { flattenEffects, parseLeadingNumber, pushMissingEffect, pushValueMismatch } from "./helpers";

function checkSimpleValueLine(
  line: string,
  prefix: string,
  nextEffect: () => { amount: number } | undefined,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  if (!line.startsWith(prefix)) return false;
  const effect = nextEffect();
  if (!effect) {
    pushMissingEffect(issues, cardId, line);
    return true;
  }
  const parsed = line === "Draw a card" ? 1 : parseLeadingNumber(line, prefix);
  if (parsed !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
  return true;
}

function checkRestoreLine(
  line: string,
  resource: "Mana" | "Health",
  nextEffect: () => { amount: number } | undefined,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  const prefix = line.startsWith("Restore ")
    ? "Restore "
    : resource === "Mana" && line.startsWith("Gain ")
      ? "Gain "
      : null;
  if (!prefix || !line.includes(resource) || line.includes("Mana Crystal") || line.includes("Maximum Mana"))
    return false;
  return checkSimpleValueLine(line, prefix, nextEffect, issues, cardId);
}

type NextDamageFn = () => (BattleCardEffect & { kind: "damage" }) | undefined;
type NextPlayerStatusFn = () => (BattleCardEffect & { kind: "player-status" }) | undefined;
type NextSimpleFn<T extends { amount: number }> = () => T | undefined;

function checkDealLine(
  line: string,
  nextDamage: NextDamageFn,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  if (!line.startsWith("Deal ")) return false;
  const describedAmount = parseLeadingNumber(line, "Deal ");
  const hitCount = line.includes("twice") ? 2 : 1;
  for (let hit = 0; hit < hitCount; hit += 1) {
    const effect = nextDamage();
    if (
      !effect ||
      effect.equalToBlock ||
      effect.equalToArmor ||
      effect.equalToGoldPercent ||
      line.includes("equal to") ||
      line.toLowerCase().includes("random")
    ) {
      continue;
    }
    if (describedAmount !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
  }
  return true;
}

function checkGoldLine(
  line: string,
  nextGold: NextSimpleFn<{ amount: number }>,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  const prefix = line.startsWith("Gain ") ? "Gain " : line.startsWith("Steal ") ? "Steal " : null;
  if (!prefix || !line.includes(" Gold")) return false;
  return checkSimpleValueLine(line, prefix, nextGold, issues, cardId);
}

function checkPerManaBlockLine(
  line: string,
  nextPlayerStatus: NextPlayerStatusFn,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  if (!line.startsWith("Gain ") || !line.includes(" Block") || !line.includes("per Mana Crystal")) return false;
  const effect = nextPlayerStatus();
  const perManaCrystal = effect?.status === "block" ? effect.perManaCrystal : undefined;
  if (perManaCrystal !== undefined && parseLeadingNumber(line, "Gain ") !== perManaCrystal)
    pushValueMismatch(issues, cardId, line, perManaCrystal);
  return true;
}

function checkStatusLine(
  line: string,
  nextPlayerStatus: NextPlayerStatusFn,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  if (
    !line.startsWith("Gain ") ||
    !(line.includes(" Block") || line.includes(" Armor") || line.includes(" Thorns") || line.includes(" Forge"))
  )
    return false;
  const effect = nextPlayerStatus();
  if (
    effect &&
    effect.status !== "haste" &&
    effect.perManaCrystal === undefined &&
    effect.convertCurrentMana === undefined &&
    parseLeadingNumber(line, "Gain ") !== effect.amount
  ) {
    pushValueMismatch(issues, cardId, line, effect.amount);
  }
  return true;
}

function checkRemoveHarmfulLine(
  line: string,
  nextRemoveHarmful: NextSimpleFn<{ amount: number; removeAll?: boolean }>,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  if (!(line.startsWith("Remove ") || line.startsWith("Cleanse ")) || !line.includes("harmful status")) return false;
  const effect = nextRemoveHarmful();
  const prefix = line.startsWith("Remove ") ? "Remove " : "Cleanse ";
  if (!effect) {
    pushMissingEffect(issues, cardId, line);
    return true;
  }
  if (effect.removeAll || line.includes("all harmful")) return true;
  if (parseLeadingNumber(line, prefix) !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
  return true;
}

function checkLoseHealthLine(
  line: string,
  nextLoseHealth: NextSimpleFn<{ amount: number }>,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  if (!line.includes("Health")) return false;
  return checkSimpleValueLine(line, "Lose ", nextLoseHealth, issues, cardId);
}

function checkGainMaxManaLine(
  line: string,
  nextGainMaxMana: NextSimpleFn<{ amount: number }>,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  if (!line.includes("Maximum Mana") && !line.includes("Mana Crystal")) return false;
  return checkSimpleValueLine(line, "Gain ", nextGainMaxMana, issues, cardId);
}

export function validateCardNumericParity(card: BattleCard): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const { effects, descriptionLines } = card;

  // Single flatten shared by all per-kind cursors below (helpers memoize
  // across cards as well, so count parity and numeric parity share the walk).
  const flat = flattenEffects(effects);
  const getNext = <T extends BattleCardEffect["kind"]>(kind: T) => {
    const filtered = flat.filter((e) => e.kind === kind) as Array<Extract<BattleCardEffect, { kind: T }>>;
    let index = 0;
    return () => filtered[index++];
  };

  const nextDamage = getNext("damage");
  const nextPlayerStatus = getNext("player-status");
  const nextHeal = getNext("heal");
  const nextRestoreMana = getNext("restore-mana");
  const nextGold = getNext("gain-gold");
  const nextWish = getNext("wish");
  const nextRemoveHarmful = getNext("remove-harmful-status");
  const nextDraw = getNext("draw-cards");
  const nextLoseHealth = getNext("lose-health");
  const nextGainMaxMana = getNext("gain-max-mana");
  const nextRemoveArmor = getNext("remove-enemy-armor");

  for (const line of descriptionLines) {
    if (line.startsWith("Deals ")) continue;
    if (checkDealLine(line, nextDamage, issues, card.id)) continue;
    if (checkGoldLine(line, nextGold, issues, card.id)) continue;
    if (checkPerManaBlockLine(line, nextPlayerStatus, issues, card.id)) continue;
    if (checkStatusLine(line, nextPlayerStatus, issues, card.id)) continue;
    if (checkRestoreLine(line, "Mana", nextRestoreMana, issues, card.id)) continue;
    if (checkRestoreLine(line, "Health", nextHeal, issues, card.id)) continue;
    if (checkSimpleValueLine(line, "Wish ", nextWish, issues, card.id)) continue;
    if (checkSimpleValueLine(line, "Draw ", nextDraw, issues, card.id)) continue;
    if (checkLoseHealthLine(line, nextLoseHealth, issues, card.id)) continue;
    if (checkGainMaxManaLine(line, nextGainMaxMana, issues, card.id)) continue;
    if (checkSimpleValueLine(line, "Strip ", nextRemoveArmor, issues, card.id)) continue;
    if (line.includes("enemy Armor") && checkSimpleValueLine(line, "Remove ", nextRemoveArmor, issues, card.id))
      continue;
    checkRemoveHarmfulLine(line, nextRemoveHarmful, issues, card.id);
  }

  return issues;
}
