import { type BattleCard, type BattleCardEffect, type BestiaryEntry } from "@/lib/game-data";
import type { ContentValidationIssue } from "./types";

export function flattenEffects(effects: BattleCardEffect[]): BattleCardEffect[] {
  return effects.flatMap((effect) =>
    effect.kind === "chance"
      ? [...flattenEffects(effect.successEffects), ...flattenEffects(effect.failureEffects)]
      : [effect],
  );
}

function countByKind(effects: BattleCardEffect[], kind: string): number {
  return flattenEffects(effects).filter((effect) => effect.kind === kind).length;
}

export function hasKind(effects: BattleCardEffect[], kind: string): boolean {
  return flattenEffects(effects).some((effect) => effect.kind === kind);
}

export function hasLifesteal(effects: BattleCardEffect[]): boolean {
  return flattenEffects(effects).some((effect) => effect.kind === "damage" && effect.lifesteal === true);
}

function hasEqualToBlockOrArmor(effects: BattleCardEffect[]): boolean {
  return effects.some(
    (effect) =>
      effect.kind === "damage" &&
      (effect.equalToBlock === true || effect.equalToArmor === true || effect.equalToGoldPercent !== undefined),
  );
}

function hasNonStandardDamageEffects(effects: BattleCardEffect[]): boolean {
  const flat = flattenEffects(effects);
  return (
    hasEqualToBlockOrArmor(flat) ||
    flat.some((effect) => effect.kind === "cleanse-player-status-to-damage" || effect.kind === "random-damage") ||
    effects.some((effect) => effect.kind === "chance")
  );
}

function countLinesStartingWith(lines: string[], prefix: string): number {
  return lines.filter((line) => line.startsWith(prefix)).length;
}

function countHealLines(lines: string[]): number {
  return lines.filter(
    (line) =>
      line.startsWith("Heal ") ||
      (line.startsWith("Restore ") && line.includes("Health")) ||
      (line.startsWith("Gain ") && line.includes("Health")),
  ).length;
}

function parseLeadingNumber(line: string, prefix: string): number | null {
  if (!line.startsWith(prefix)) return null;
  const match = line.slice(prefix.length).match(/^\+?(\d+)/);
  return match ? Number(match[1]) : null;
}

function pushMissingEffect(issues: ContentValidationIssue[], id: string, line: string): void {
  issues.push({
    severity: "error",
    area: "cards",
    id,
    message: `"${line}" has no matching effect`,
  });
}

function pushValueMismatch(issues: ContentValidationIssue[], id: string, line: string, actual: number): void {
  issues.push({
    severity: "error",
    area: "cards",
    id,
    message: `"${line}" does not match authored amount ${actual}`,
  });
}

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

function validateCardNumericParity(card: BattleCard): ContentValidationIssue[] {
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

interface CountParityRule {
  label: string;
  countLines: (lines: string[]) => number;
  countEffects: (effects: BattleCardEffect[]) => number;
}

const COUNT_PARITY_RULES: CountParityRule[] = [
  {
    label: "heal",
    countLines: countHealLines,
    countEffects: (effects) => countByKind(effects, "heal"),
  },
  {
    label: "restore-mana",
    countLines: (lines) => lines.filter((line) => line.startsWith("Restore ") && !line.includes("Health")).length,
    countEffects: (effects) => countByKind(effects, "restore-mana"),
  },
  {
    label: "gain-gold",
    countLines: (lines) =>
      lines.filter((line) => (line.startsWith("Gain ") || line.startsWith("Steal ")) && line.includes("Gold")).length +
      lines.filter((line) => line.includes(" or Gain ") && line.includes("Gold")).length,
    countEffects: (effects) => countByKind(effects, "gain-gold"),
  },
  {
    label: "wish",
    countLines: (lines) => countLinesStartingWith(lines, "Wish "),
    countEffects: (effects) => countByKind(effects, "wish"),
  },
  {
    label: "remove-harmful-status",
    countLines: (lines) =>
      lines.filter(
        (line) => line.startsWith("Remove ") || (line.startsWith("Cleanse ") && line.includes("harmful status")),
      ).length,
    countEffects: (effects) => countByKind(effects, "remove-harmful-status"),
  },
  {
    label: "lose-max-mana",
    countLines: (lines) => lines.filter((line) => line.startsWith("Lose ") && line.includes("Mana Crystal")).length,
    countEffects: (effects) => countByKind(effects, "lose-max-mana"),
  },
  {
    label: "gain-max-mana",
    countLines: (lines) => lines.filter((line) => line.includes("Maximum Mana")).length,
    countEffects: (effects) => countByKind(effects, "gain-max-mana"),
  },
  {
    label: "lose-health",
    countLines: (lines) => lines.filter((line) => line.startsWith("Lose ") && line.includes("Health")).length,
    countEffects: (effects) => countByKind(effects, "lose-health"),
  },
  {
    label: "draw-cards",
    countLines: (lines) => countLinesStartingWith(lines, "Draw "),
    countEffects: (effects) => countByKind(effects, "draw-cards"),
  },
  {
    label: "remove-enemy-armor",
    countLines: (lines) => countLinesStartingWith(lines, "Strip "),
    countEffects: (effects) => countByKind(effects, "remove-enemy-armor"),
  },
  {
    label: "multiply-enemy-status",
    countLines: (lines) => countLinesStartingWith(lines, "Double "),
    countEffects: (effects) => countByKind(effects, "multiply-enemy-status"),
  },
  {
    label: "remove-player-status",
    countLines: (lines) =>
      lines.filter((line) => line.startsWith("Cleanse ") && !line.includes("harmful status")).length,
    countEffects: (effects) =>
      countByKind(effects, "remove-player-status") + countByKind(effects, "cleanse-player-status-to-damage"),
  },
  {
    label: "block",
    countLines: (lines) =>
      lines.filter(
        (line) =>
          line.startsWith("Gain ") &&
          line.includes(" Block") &&
          !line.includes("per Mana Crystal") &&
          !line.endsWith("each turn"),
      ).length,
    countEffects: (effects) =>
      effects.filter(
        (effect) => effect.kind === "player-status" && effect.status === "block" && effect.perManaCrystal === undefined,
      ).length,
  },
  {
    label: "per-mana block",
    countLines: (lines) => lines.filter((line) => line.includes("per Mana Crystal")).length,
    countEffects: (effects) =>
      effects.filter(
        (effect) => effect.kind === "player-status" && effect.status === "block" && effect.perManaCrystal !== undefined,
      ).length,
  },
  {
    label: "armor",
    countLines: (lines) => lines.filter((line) => line.startsWith("Gain ") && line.includes(" Armor")).length,
    countEffects: (effects) =>
      effects.filter((effect) => effect.kind === "player-status" && effect.status === "armor").length,
  },
  {
    label: "forge",
    countLines: (lines) => lines.filter((line) => line.startsWith("Gain ") && line.includes(" Forge")).length,
    countEffects: (effects) =>
      effects.filter((effect) => effect.kind === "player-status" && effect.status === "forge").length,
  },
];

function checkDamageParity(card: BattleCard): ContentValidationIssue | null {
  const { effects, descriptionLines } = card;
  if (hasNonStandardDamageEffects(effects)) return null;
  if (hasKind(effects, "self-damage")) {
    if (!descriptionLines.some((line) => /self|Receive/.test(line))) {
      return {
        severity: "error",
        area: "cards",
        id: card.id,
        message: "Self-damage effect is missing matching description text",
      };
    }
  } else {
    const dealLines = descriptionLines.filter(
      (line) => line.startsWith("Deal ") && !line.includes("equal to") && !line.toLowerCase().includes("random"),
    ).length;
    const damageEffects = countByKind(effects, "damage") + countByKind(effects, "random-damage");
    if (dealLines !== damageEffects) {
      return {
        severity: "error",
        area: "cards",
        id: card.id,
        message: `damage description count ${dealLines} does not match effect count ${damageEffects}`,
      };
    }
  }
  return null;
}

function checkHasteParity(card: BattleCard): ContentValidationIssue | null {
  const { effects, descriptionLines } = card;
  if (
    effects.some((effect) => effect.kind === "player-status" && effect.status === "haste") &&
    !descriptionLines.some((line) => line.includes("extra turn"))
  ) {
    return {
      severity: "error",
      area: "cards",
      id: card.id,
      message: "Haste effect is missing extra-turn description text",
    };
  }
  return null;
}

function checkPhoenixFeatherParity(card: BattleCard): ContentValidationIssue | null {
  const { effects, descriptionLines } = card;
  if (
    flattenEffects(effects).some((effect) => effect.kind === "player-status" && effect.status === "phoenixFeather") &&
    !descriptionLines.some((line) => line.includes("die") || line.includes("30%"))
  ) {
    return {
      severity: "error",
      area: "cards",
      id: card.id,
      message: "Phoenix Feather effect is missing revive description text",
    };
  }
  return null;
}

function checkBuffCompanionParity(card: BattleCard): ContentValidationIssue | null {
  if (hasKind(card.effects, "self-damage")) return null;
  const described = countLinesStartingWith(card.descriptionLines, "Increase ");
  const actual = countByKind(card.effects, "buff-companion");
  if (described !== actual) {
    return {
      severity: "error",
      area: "cards",
      id: card.id,
      message: `buff-companion description count ${described} does not match effect count ${actual}`,
    };
  }
  return null;
}

function checkLifestealParity(card: BattleCard): ContentValidationIssue | null {
  if (!hasLifesteal(card.effects)) return null;
  if (!card.descriptionLines.some((line) => line === "Leech")) {
    return {
      severity: "warning",
      area: "cards",
      id: card.id,
      message: "Lifesteal effect is missing Leech description line",
    };
  }
  return null;
}

function checkArcheryTagParity(card: BattleCard): ContentValidationIssue | null {
  const hasArcheryTag = card.tags?.includes("archery");
  const hasArcheryLine = card.descriptionLines.some((line) => line === "Archery");
  if (hasArcheryTag && !hasArcheryLine) {
    return {
      severity: "warning",
      area: "cards",
      id: card.id,
      message: "Archery tag is missing Archery description line",
    };
  }
  if (hasArcheryLine && !hasArcheryTag) {
    return {
      severity: "warning",
      area: "cards",
      id: card.id,
      message: "Archery description line is missing archery tag",
    };
  }
  return null;
}

function checkConsumeParity(card: BattleCard): ContentValidationIssue | null {
  if (card.consume !== true) return null;
  const hasConsume = card.descriptionLines.some((line) => line === "Consume");
  const hasCompanion =
    hasKind(card.effects, "summon-companion") && card.descriptionLines.some((line) => line === "Companion");
  if (!hasConsume && !hasCompanion) {
    return {
      severity: "warning",
      area: "cards",
      id: card.id,
      message: "consume:true is missing Consume or Companion description line",
    };
  }
  return null;
}

function checkCompanionParity(card: BattleCard): ContentValidationIssue | null {
  if (!hasKind(card.effects, "summon-companion")) return null;
  if (!card.descriptionLines.some((line) => line.includes("Companion"))) {
    return {
      severity: "warning",
      area: "cards",
      id: card.id,
      message: "summon-companion effect is missing Companion description line",
    };
  }
  return null;
}

function checkRuleParity(card: BattleCard): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  for (const rule of COUNT_PARITY_RULES) {
    const described = rule.countLines(card.descriptionLines);
    const actual = rule.countEffects(card.effects);
    if (described !== actual) {
      issues.push({
        severity: "error",
        area: "cards",
        id: card.id,
        message: `${rule.label} description count ${described} does not match effect count ${actual}`,
      });
    }
  }
  return issues;
}

export function validateCardDescriptionParity(card: BattleCard): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];

  const check = checkDamageParity(card);
  if (check) issues.push(check);

  issues.push(...checkRuleParity(card));

  for (const fn of [
    checkHasteParity,
    checkPhoenixFeatherParity,
    checkBuffCompanionParity,
    checkLifestealParity,
    checkArcheryTagParity,
    checkConsumeParity,
    checkCompanionParity,
  ]) {
    const result = fn(card);
    if (result) issues.push(result);
  }

  return [...issues, ...validateCardNumericParity(card)];
}

const TRAIT_REQUIRED_PATTERNS: Record<string, { pattern: RegExp; term: string }> = {
  "iron-hide": { pattern: /armor/, term: "armor" },
  "rusting-carapace": { pattern: /forge/, term: "forge" },
  "glacial-shell": { pattern: /freeze|burn/, term: "freeze or burn" },
  regeneration: { pattern: /health|heal/, term: "health or heal" },
  "brittle-bones": { pattern: /holy|stun/, term: "holy or stun" },
  "trinket-hoarder": { pattern: /burn|trinket/, term: "burn or trinket" },
  "burn-resistance": { pattern: /burn/, term: "burn" },
  "poison-resistance": { pattern: /poison/, term: "poison" },
  "holy-vulnerability": { pattern: /holy/, term: "holy" },
  "living-armor": { pattern: /bleed|armor/, term: "bleed or armor" },
  "gold-trove": { pattern: /gold/, term: "gold" },
};

export function validateEnemyTraitDescriptionParity(enemy: BestiaryEntry): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  for (const trait of enemy.traits) {
    const config = TRAIT_REQUIRED_PATTERNS[trait.id];
    if (config && !config.pattern.test(trait.description.toLowerCase())) {
      issues.push({
        severity: "error",
        area: "enemies",
        id: enemy.id,
        message: `Trait "${trait.id}" description does not mention ${config.term}`,
      });
    }
  }
  return issues;
}
