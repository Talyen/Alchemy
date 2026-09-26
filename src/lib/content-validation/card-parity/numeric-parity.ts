import { conditionalDamageDescription } from "@/lib/game-data";
import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { capitalizeWord } from "@/lib/utils";
import type { ContentValidationIssue } from "../types";
import {
  createEffectQueues,
  parseLeadingNumber,
  pushMissingEffect,
  pushValueMismatch,
  type CardEffectIndex,
  type EffectQueues,
} from "./helpers";
import {
  cleanseLineEffectCount,
  isBlockLine,
  isCompanionActionLine,
  isConvertManaBlockLine,
  isDieRollLine,
  isDoubleLine,
  isDrawLine,
  isGainMaxManaLine,
  isGainStatusLine,
  isGoldLine,
  isHealLine,
  isLoseHealthLine,
  isLoseMaxManaLine,
  isNonStandardDealLine,
  isPerManaBlockLine,
  isRandomDrawLine,
  isRemoveEnemyArmorLine,
  isRemoveHarmfulStatusLine,
  isRestoreManaLine,
  isWishLine,
  parseDealLineShape,
} from "./line-classifiers";

function checkSimpleValueLine(
  line: string,
  prefix: string,
  nextEffect: () => { amount?: number } | undefined,
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
  // Callers with removeAll shapes intercept those lines before reaching here,
  // so amount is always present; the fallback only satisfies the type.
  if (parsed !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount ?? 0);
  return true;
}

function checkDealLine(line: string, next: EffectQueues, issues: ContentValidationIssue[], cardId: string): boolean {
  const shape = parseDealLineShape(line);
  if (!shape) return false;
  const describedAmount = line.startsWith("Deal and Receive ")
    ? parseLeadingNumber(line, "Deal and Receive ")
    : parseLeadingNumber(line, "Deal ");
  const nonStandard = isNonStandardDealLine(line);
  const hitCount = shape.twice || shape.delayedSecondAmount !== null || shape.sharedDelayed ? 2 : 1;
  for (let hit = 0; hit < hitCount; hit += 1) {
    const effect = next("damage");
    if (effect && conditionalDamageDescription(effect)) {
      if (
        effect.kind === "damage" &&
        effect.damageTypeIfTargetFrozen === effect.damageType &&
        line === `Deal ${effect.amount} ${capitalizeWord(effect.damageType)} damage`
      ) {
        continue;
      }
      if (line !== conditionalDamageDescription(effect)) pushValueMismatch(issues, cardId, line, effect.amount);
      continue;
    }
    if (
      !effect ||
      effect.equalToBlock ||
      effect.equalToArmor ||
      effect.equalToForge ||
      effect.equalToGoldPercent ||
      nonStandard
    ) {
      continue;
    }
    const expected = hit === 1 && shape.delayedSecondAmount !== null ? shape.delayedSecondAmount : describedAmount;
    if (expected !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
  }
  return true;
}

function checkRemoveHarmfulLine(line: string, next: EffectQueues, issues: ContentValidationIssue[], cardId: string) {
  if (!isRemoveHarmfulStatusLine(line)) return;
  const effect = next("remove-harmful-status");
  const prefix = line.startsWith("Remove ") ? "Remove " : "Cleanse ";
  if (!effect) {
    pushMissingEffect(issues, cardId, line);
    return;
  }
  if (line.includes("all harmful")) {
    if (!effect.removeAll) pushMissingEffect(issues, cardId, line);
    return;
  }
  if (line === "Cleanse a harmful status effect") {
    if (effect.amount !== 1) pushValueMismatch(issues, cardId, line, effect.amount ?? 0);
    return;
  }
  // A full cleanse carries no amount — a numeric line against it falls through
  // to the mismatch below (parsed vs 0), mirroring remove-enemy-armor.
  if (parseLeadingNumber(line, prefix) !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount ?? 0);
}

// Narrow value gates for the two documented divergences from the loose count
// predicates: only Gain/Steal-prefixed lines consume the gain-gold cursor, and
// mid-sentence "Restore ... Mana" phrasing counts without consuming a cursor.
function isGoldValueLine(line: string): boolean {
  if (!line.includes(" Gold")) return false;
  return line.startsWith("Gain ") || line.startsWith("Steal ") || line.startsWith("Steals ");
}

function isRestoreManaValueLine(line: string): boolean {
  const prefix = line.startsWith("Restore ") ? "Restore " : line.startsWith("Gain ") ? "Gain " : null;
  return prefix !== null && line.includes("Mana") && !line.includes("Mana Crystal") && !line.includes("Maximum Mana");
}

// Heal counts accept "Heal "/"Gain ... Health" phrasing, but values only cover
// "Restore X Health". Gain-max-mana lines always use the Gain prefix.
function isRestoreHealthValueLine(line: string): boolean {
  return line.startsWith("Restore ") && line.includes("Health");
}

function isGainMaxManaValueLine(line: string): boolean {
  // Keep the numeric gate broader than count parity: custom wording such as
  // "Gain +1 Maximum Mana" must still consume and validate an effect.
  return line.startsWith("Gain ") && (line.includes("Maximum Mana") || line.includes("Mana Crystal"));
}

interface ValueRule {
  matches: (line: string) => boolean;
  check: (line: string, next: EffectQueues, issues: ContentValidationIssue[], cardId: string) => void;
}

type SimpleEffectKind =
  | "gain-gold"
  | "restore-mana"
  | "heal"
  | "wish"
  | "draw-cards"
  | "remove-enemy-armor"
  | "lose-health"
  | "gain-max-mana";

function fixedValue(
  matches: (line: string) => boolean,
  prefix: string | ((line: string) => string),
  kind: SimpleEffectKind,
): ValueRule {
  return {
    matches,
    check: (line, next, issues, cardId) =>
      checkSimpleValueLine(
        line,
        typeof prefix === "function" ? prefix(line) : prefix,
        () => next(kind),
        issues,
        cardId,
      ),
  };
}

const restorePrefix = (line: string): string => (line.startsWith("Restore ") ? "Restore " : "Gain ");

// Value rules in the exact precedence of the previous checker chain: gold,
// per-mana block, plain status, restore, then the single-prefix families, then
// Remove-prefixed armor. Unmatched lines fall through to harmful-status.
const VALUE_RULES: ValueRule[] = [
  fixedValue(
    isGoldValueLine,
    (line) => (line.startsWith("Gain ") ? "Gain " : line.startsWith("Steal ") ? "Steal " : "Steals "),
    "gain-gold",
  ),
  {
    matches: (line) => line.startsWith("Gain ") && line.includes(" Block") && isPerManaBlockLine(line),
    check: (line, next, issues, cardId) => {
      const effect = next("player-status");
      const perManaCrystal = effect?.status === "block" ? effect.perManaCrystal : undefined;
      if (perManaCrystal !== undefined && parseLeadingNumber(line, "Gain ") !== perManaCrystal)
        pushValueMismatch(issues, cardId, line, perManaCrystal);
    },
  },
  {
    // Runs after the per-mana rule, so per-mana lines never reach here.
    matches: (line) =>
      line.startsWith("Gain ") &&
      (line.includes(" Block") || line.includes(" Armor") || line.includes(" Thorns") || line.includes(" Forge")),
    check: (line, next, issues, cardId) => {
      const effect = next("player-status");
      if (
        effect &&
        effect.status !== "haste" &&
        effect.perManaCrystal === undefined &&
        effect.convertCurrentMana === undefined &&
        parseLeadingNumber(line, "Gain ") !== effect.amount
      ) {
        pushValueMismatch(issues, cardId, line, effect.amount);
      }
    },
  },
  fixedValue(isRestoreManaValueLine, restorePrefix, "restore-mana"),
  fixedValue(isRestoreHealthValueLine, "Restore ", "heal"),
  fixedValue((line) => line.startsWith("Wish "), "Wish ", "wish"),
  fixedValue((line) => line.startsWith("Draw "), "Draw ", "draw-cards"),
  fixedValue((line) => line.startsWith("Strip "), "Strip ", "remove-enemy-armor"),
  fixedValue(isLoseHealthLine, "Lose ", "lose-health"),
  fixedValue(isGainMaxManaValueLine, "Gain ", "gain-max-mana"),
  fixedValue((line) => isRemoveEnemyArmorLine(line) && line.startsWith("Remove "), "Remove ", "remove-enemy-armor"),
];

function checkNumericLine(line: string, next: EffectQueues, issues: ContentValidationIssue[], cardId: string): void {
  if (isDieRollLine(line)) {
    const effect = next("random-draw");
    if (!effect) pushMissingEffect(issues, cardId, line);
    else if (effect.minAmount !== 1 || effect.maxAmount !== 6)
      pushValueMismatch(issues, cardId, line, effect.maxAmount);
    return;
  }
  if (isRandomDrawLine(line)) return;
  if (isCompanionActionLine(line)) {
    const effect = next("companion-action");
    const amount = line.endsWith("twice")
      ? 2
      : line.endsWith("once")
        ? 1
        : parseLeadingNumber(line, "Your Companion acts ");
    if (!effect) pushMissingEffect(issues, cardId, line);
    else if (amount !== effect.amount) pushValueMismatch(issues, cardId, line, effect.amount);
    return;
  }
  if (line === "Remove all enemy Armor") {
    const effect = next("remove-enemy-armor");
    if (!effect?.removeAll) pushMissingEffect(issues, cardId, line);
    return;
  }
  if (line === "Halve enemy Armor") {
    const effect = next("remove-enemy-armor");
    if (!effect?.halve) pushMissingEffect(issues, cardId, line);
    return;
  }
  if (line.startsWith("Deals ")) return;
  if (checkDealLine(line, next, issues, cardId)) return;
  for (const rule of VALUE_RULES) {
    if (!rule.matches(line)) continue;
    rule.check(line, next, issues, cardId);
    return;
  }
  checkRemoveHarmfulLine(line, next, issues, cardId);
}

const asOne = (match: (line: string) => boolean) => (line: string) => (match(line) ? 1 : 0);

// One row per card-line family: the count label, how a line counts toward it,
// and (optionally) which precomputed actual it compares against. This replaces
// both the count-rule table in index.ts and the numeric cursor chain — the two
// documented count-only divergences (loose Gold phrasing, mid-sentence
// Restore-Mana) have rows here but no value rule above.
const COUNT_ROWS: Array<[label: string, counted: (line: string) => number, actualKey?: string]> = [
  ["heal", asOne(isHealLine)],
  ["restore-mana", asOne(isRestoreManaLine)],
  ["gain-gold", asOne(isGoldLine)],
  ["wish", asOne(isWishLine)],
  ["remove-harmful-status", asOne(isRemoveHarmfulStatusLine)],
  ["lose-max-mana", asOne(isLoseMaxManaLine)],
  ["gain-max-mana", asOne(isGainMaxManaLine)],
  ["lose-health", asOne(isLoseHealthLine)],
  ["draw-cards", asOne(isDrawLine)],
  // "Roll a six-sided die" and "Draw that many cards" co-occur with a single
  // random-draw effect: both rows compare against the same effect count, so a
  // card with only one of the two lines fails with a count mismatch.
  ["random-draw", asOne(isRandomDrawLine)],
  ["random-draw die", asOne(isDieRollLine), "random-draw"],
  ["companion-action", asOne(isCompanionActionLine)],
  ["remove-enemy-armor", asOne(isRemoveEnemyArmorLine)],
  ["multiply-enemy-status", asOne(isDoubleLine)],
  ["remove-player-status", cleanseLineEffectCount],
  ["block", asOne(isBlockLine)],
  ["convert-mana block", asOne(isConvertManaBlockLine)],
  ["per-mana block", asOne(isPerManaBlockLine)],
  ["armor", asOne((line) => isGainStatusLine(line, "Armor"))],
  ["forge", asOne((line) => isGainStatusLine(line, "Forge"))],
  ["thorns", asOne((line) => isGainStatusLine(line, "Thorns"))],
];

function countChanceVariants(chanceFlat: BattleCardEffect[]): {
  block: number;
  convert: number;
  perMana: number;
  armor: number;
  forge: number;
  thorns: number;
} {
  let block = 0;
  let convert = 0;
  let perMana = 0;
  let armor = 0;
  let forge = 0;
  let thorns = 0;
  for (const effect of chanceFlat) {
    if (effect.kind !== "player-status") continue;
    if (effect.status === "block") {
      if (effect.perManaCrystal !== undefined) perMana += 1;
      if (effect.convertCurrentMana !== undefined) convert += 1;
      if (
        effect.perManaCrystal === undefined &&
        effect.convertCurrentMana === undefined &&
        (effect.statusPool === undefined || effect.statusPool.includes("block"))
      )
        block += 1;
    }
    if (effect.status === "armor" || effect.statusPool?.includes("armor") === true) armor += 1;
    if (effect.status === "forge" || effect.statusPool?.includes("forge") === true) forge += 1;
    if (effect.status === "thorns" || effect.statusPool?.includes("thorns") === true) thorns += 1;
  }
  return { block, convert, perMana, armor, forge, thorns };
}

/**
 * Single pass over a card's description lines checking both family counts
 * and numeric values. Tallies and value cursors stay independent (a line may
 * count toward several families but consumes at most one value cursor),
 * matching the previous two-loop behavior exactly.
 */
export function validateCardLineParity(
  card: BattleCard,
  lines: string[],
  index: CardEffectIndex,
): ContentValidationIssue[] {
  const variants = countChanceVariants(index.chanceFlat);
  const actual: Record<string, number> = {
    heal: index.countKind("heal"),
    "restore-mana": index.countKind("restore-mana"),
    "gain-gold": index.countKind("gain-gold"),
    wish: index.countKind("wish"),
    "remove-harmful-status": index.countKind("remove-harmful-status"),
    "lose-max-mana": index.countKind("lose-max-mana"),
    "gain-max-mana": index.countKind("gain-max-mana"),
    "lose-health": index.countKind("lose-health"),
    "draw-cards": index.countKind("draw-cards"),
    "random-draw": index.countKind("random-draw"),
    "companion-action": index.countKind("companion-action"),
    "remove-enemy-armor": index.countKind("remove-enemy-armor"),
    "multiply-enemy-status": index.countKind("multiply-enemy-status"),
    "remove-player-status":
      index.countKind("remove-player-status") + index.countKind("cleanse-player-status-to-damage"),
    block: variants.block,
    "convert-mana block": variants.convert,
    "per-mana block": variants.perMana,
    armor: variants.armor,
    forge: variants.forge,
    thorns: variants.thorns,
  };
  const values: ContentValidationIssue[] = [];
  const next = createEffectQueues(index.flat);
  const described = new Map<string, number>();
  for (const line of lines) {
    for (const [label, counted] of COUNT_ROWS) {
      const n = counted(line);
      if (n > 0) described.set(label, (described.get(label) ?? 0) + n);
    }
    checkNumericLine(line, next, values, card.id);
  }
  const issues: ContentValidationIssue[] = [];
  for (const [label, , actualKey] of COUNT_ROWS) {
    const count = described.get(label) ?? 0;
    const expected = actual[actualKey ?? label] ?? 0;
    if (count !== expected) {
      issues.push({
        severity: "error",
        area: "cards",
        id: card.id,
        message: `${label} description count ${count} does not match effect count ${expected}`,
      });
    }
  }
  return [...issues, ...values];
}
