import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";
import { parseLeadingNumber, pushMissingEffect, pushValueMismatch } from "./helpers";

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
  const parsed = parseLeadingNumber(line, prefix);
  if (parsed !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
  return true;
}

function checkRestoreManaLine(
  line: string,
  nextEffect: () => { amount: number } | undefined,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  if (!line.startsWith("Restore ") || !line.includes("Mana")) return false;
  const effect = nextEffect();
  if (!effect) {
    pushMissingEffect(issues, cardId, line);
    return true;
  }
  if (parseLeadingNumber(line, "Restore ") !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
  return true;
}

function checkRestoreHealthLine(
  line: string,
  nextEffect: () => { amount: number } | undefined,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  if (!line.startsWith("Restore ") || !line.includes("Health")) return false;
  const effect = nextEffect();
  if (!effect) {
    pushMissingEffect(issues, cardId, line);
    return true;
  }
  if (parseLeadingNumber(line, "Restore ") !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
  return true;
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
  const effect = nextDamage();
  if (
    !effect ||
    effect.equalToBlock ||
    effect.equalToArmor ||
    effect.equalToGoldPercent ||
    line.includes("equal to") ||
    line.toLowerCase().includes("random")
  ) {
    return true;
  }
  if (parseLeadingNumber(line, "Deal ") !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
  return true;
}

function checkGoldLine(
  line: string,
  nextGold: NextSimpleFn<{ amount: number }>,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  if (!line.startsWith("Gain ") || !line.includes(" Gold")) return false;
  const effect = nextGold();
  if (!effect) {
    pushMissingEffect(issues, cardId, line);
    return true;
  }
  if (parseLeadingNumber(line, "Gain ") !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
  return true;
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
  if (!line.startsWith("Gain ") || !(line.includes(" Block") || line.includes(" Armor") || line.includes(" Forge")))
    return false;
  const effect = nextPlayerStatus();
  if (
    effect &&
    effect.status !== "haste" &&
    effect.perManaCrystal === undefined &&
    parseLeadingNumber(line, "Gain ") !== effect.amount
  ) {
    pushValueMismatch(issues, cardId, line, effect.amount);
  }
  return true;
}

function checkRemoveHarmfulLine(
  line: string,
  nextRemoveHarmful: NextSimpleFn<{ amount: number }>,
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
  if (parseLeadingNumber(line, prefix) !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
  return true;
}

function checkWishLine(
  line: string,
  nextWish: NextSimpleFn<{ amount: number }>,
  issues: ContentValidationIssue[],
  cardId: string,
): boolean {
  if (!line.startsWith("Wish ")) return false;
  const effect = nextWish();
  if (!effect) {
    pushMissingEffect(issues, cardId, line);
    return true;
  }
  if (parseLeadingNumber(line, "Wish ") !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
  return true;
}

export function validateCardNumericParity(card: BattleCard): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const { effects, descriptionLines } = card;

  const getNext = <T extends BattleCardEffect["kind"]>(kind: T) => {
    const filtered = effects.filter((e) => e.kind === kind) as Array<Extract<BattleCardEffect, { kind: T }>>;
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

  for (const line of descriptionLines) {
    if (line.startsWith("Deals ")) continue;
    if (checkDealLine(line, nextDamage, issues, card.id)) continue;
    if (checkGoldLine(line, nextGold, issues, card.id)) continue;
    if (checkPerManaBlockLine(line, nextPlayerStatus, issues, card.id)) continue;
    if (checkStatusLine(line, nextPlayerStatus, issues, card.id)) continue;
    if (checkSimpleValueLine(line, "Heal ", nextHeal, issues, card.id)) continue;
    if (checkRestoreManaLine(line, nextRestoreMana, issues, card.id)) continue;
    if (checkRestoreHealthLine(line, nextHeal, issues, card.id)) continue;
    if (checkWishLine(line, nextWish, issues, card.id)) continue;
    checkRemoveHarmfulLine(line, nextRemoveHarmful, issues, card.id);
  }

  return issues;
}
