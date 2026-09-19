import { type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";
import {
  countByKind,
  countLinesStartingWith,
  flattenChanceEffects,
  flattenEffects,
  hasKind,
  hasLifesteal,
  hasNonStandardDamageEffects,
} from "./helpers";
import {
  isBlockLine,
  isCleanseLine,
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
import { validateCardNumericParity } from "./numeric-parity";

interface CountParityRule {
  label: string;
  countLines: (lines: string[]) => number;
  // Both effect lists are flattened once per card by checkRuleParity: the full
  // flatten (all wrappers unwrapped) and the chance-only flatten (repeat-over-
  // turns wrappers kept, since repeat lines use excluded "each turn" wording).
  countEffects: (flat: BattleCardEffect[], chanceFlat: BattleCardEffect[]) => number;
}

function countKind(flat: BattleCardEffect[], kind: BattleCardEffect["kind"]): number {
  return flat.filter((effect) => effect.kind === kind).length;
}

function kindCountRule(
  label: string,
  isLine: (line: string) => boolean,
  kind: BattleCardEffect["kind"],
  extraKind?: BattleCardEffect["kind"],
): CountParityRule {
  return {
    label,
    countLines: (lines) => lines.filter(isLine).length,
    countEffects: (flat) => countKind(flat, kind) + (extraKind ? countKind(flat, extraKind) : 0),
  };
}

function blockVariantRule(
  label: string,
  isLine: (line: string) => boolean,
  hasVariant: (effect: BattleCardEffect) => boolean,
): CountParityRule {
  return {
    label,
    countLines: (lines) => lines.filter(isLine).length,
    countEffects: (_flat, chanceFlat) => chanceFlat.filter(hasVariant).length,
  };
}

function isPlainBlock(effect: BattleCardEffect): boolean {
  return (
    effect.kind === "player-status" &&
    effect.status === "block" &&
    effect.perManaCrystal === undefined &&
    effect.convertCurrentMana === undefined
  );
}

function isConvertBlock(effect: BattleCardEffect): boolean {
  return effect.kind === "player-status" && effect.status === "block" && effect.convertCurrentMana !== undefined;
}

function isPerManaBlock(effect: BattleCardEffect): boolean {
  return effect.kind === "player-status" && effect.status === "block" && effect.perManaCrystal !== undefined;
}

function statusParityRule(status: "armor" | "forge" | "thorns", name: string): CountParityRule {
  return {
    label: status,
    countLines: (lines) => lines.filter((line) => isGainStatusLine(line, name)).length,
    countEffects: (_flat, chanceFlat) =>
      chanceFlat.filter((effect) => effect.kind === "player-status" && effect.status === status).length,
  };
}

const COUNT_PARITY_RULES: CountParityRule[] = [
  kindCountRule("heal", isHealLine, "heal"),
  kindCountRule("restore-mana", isRestoreManaLine, "restore-mana"),
  kindCountRule("gain-gold", isGoldLine, "gain-gold"),
  kindCountRule("wish", isWishLine, "wish"),
  kindCountRule("remove-harmful-status", isRemoveHarmfulStatusLine, "remove-harmful-status"),
  kindCountRule("lose-max-mana", isLoseMaxManaLine, "lose-max-mana"),
  kindCountRule("gain-max-mana", isGainMaxManaLine, "gain-max-mana"),
  kindCountRule("lose-health", isLoseHealthLine, "lose-health"),
  kindCountRule("draw-cards", isDrawLine, "draw-cards"),
  // "Roll a six-sided die" and "Draw that many cards" co-occur with a single
  // random-draw effect: both rules compare against the same effect count, so a
  // card with only one of the two lines fails with a count mismatch.
  kindCountRule("random-draw", isRandomDrawLine, "random-draw"),
  kindCountRule("random-draw die", isDieRollLine, "random-draw"),
  kindCountRule("companion-action", isCompanionActionLine, "companion-action"),
  kindCountRule("remove-enemy-armor", isRemoveEnemyArmorLine, "remove-enemy-armor"),
  kindCountRule("multiply-enemy-status", isDoubleLine, "multiply-enemy-status"),
  kindCountRule("remove-player-status", isCleanseLine, "remove-player-status", "cleanse-player-status-to-damage"),
  blockVariantRule("block", isBlockLine, isPlainBlock),
  blockVariantRule("convert-mana block", isConvertManaBlockLine, isConvertBlock),
  blockVariantRule("per-mana block", isPerManaBlockLine, isPerManaBlock),
  statusParityRule("armor", "Armor"),
  statusParityRule("forge", "Forge"),
  statusParityRule("thorns", "Thorns"),
];

export { validateEnemyTraitDescriptionParity, TRAIT_REQUIRED_PATTERNS } from "./enemy-trait-parity";
export { validateTrinketDescriptionParity } from "./trinket-parity";
export { flattenEffects } from "./helpers";

function checkDamageParity(card: BattleCard): ContentValidationIssue | null {
  const { effects, descriptionLines } = card;
  if (hasNonStandardDamageEffects(effects)) return null;
  if (hasKind(effects, "self-damage")) {
    if (!descriptionLines.some((line) => /self|Receive|Take/.test(line))) {
      return {
        severity: "error",
        area: "cards",
        id: card.id,
        message: "Self-damage effect is missing matching description text",
      };
    }
  } else {
    const dealLines = descriptionLines.reduce((count, line) => {
      const shape = parseDealLineShape(line);
      if (!shape || isNonStandardDealLine(line)) return count;
      return count + (shape.twice ? 2 : 1);
    }, 0);
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

function cardIssue(severity: "error" | "warning", id: string, message: string): ContentValidationIssue {
  return { severity, area: "cards", id, message };
}

interface PresenceParityCheck {
  hasEffect: (card: BattleCard) => boolean;
  hasText: (card: BattleCard) => boolean;
  message: string;
}

const PRESENCE_PARITY_CHECKS: PresenceParityCheck[] = [
  {
    hasEffect: (card) => card.effects.some((effect) => effect.kind === "player-status" && effect.status === "haste"),
    hasText: (card) => card.descriptionLines.some((line) => line.includes("extra turn")),
    message: "Haste effect is missing extra-turn description text",
  },
  {
    hasEffect: (card) =>
      flattenEffects(card.effects).some(
        (effect) => effect.kind === "player-status" && effect.status === "phoenixFeather",
      ),
    hasText: (card) => card.descriptionLines.some((line) => line.includes("die") || line.includes("30%")),
    message: "Phoenix Feather effect is missing revive description text",
  },
];

function checkBuffCompanionParity(card: BattleCard): ContentValidationIssue | null {
  if (hasKind(card.effects, "self-damage")) return null;
  const described = countLinesStartingWith(card.descriptionLines, "Increase ");
  const actual = countByKind(card.effects, "buff-companion");
  if (described !== actual) {
    return cardIssue(
      "error",
      card.id,
      `buff-companion description count ${described} does not match effect count ${actual}`,
    );
  }
  return null;
}

function checkTagWarnings(card: BattleCard): ContentValidationIssue[] {
  const warnings: ContentValidationIssue[] = [];
  if (hasLifesteal(card.effects) && !card.descriptionLines.some((line) => line === "Leech"))
    warnings.push(cardIssue("warning", card.id, "Lifesteal effect is missing Leech description line"));
  const hasArcheryTag = card.tags?.includes("archery") === true;
  const hasArcheryLine = card.descriptionLines.some((line) => line === "Archery");
  if (hasArcheryTag !== hasArcheryLine)
    warnings.push(
      cardIssue(
        "warning",
        card.id,
        hasArcheryTag
          ? "Archery tag is missing Archery description line"
          : "Archery description line is missing archery tag",
      ),
    );
  if (card.consume === true) {
    const hasConsume = card.descriptionLines.some((line) => line === "Consume");
    const hasCompanion =
      hasKind(card.effects, "summon-companion") && card.descriptionLines.some((line) => line === "Companion");
    if (!hasConsume && !hasCompanion)
      warnings.push(cardIssue("warning", card.id, "consume:true is missing Consume or Companion description line"));
  }
  if (hasKind(card.effects, "summon-companion") && !card.descriptionLines.some((line) => line.includes("Companion")))
    warnings.push(cardIssue("warning", card.id, "summon-companion effect is missing Companion description line"));
  return warnings;
}

function checkRuleParity(card: BattleCard): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const flat = flattenEffects(card.effects);
  const chanceFlat = flattenChanceEffects(card.effects);
  for (const rule of COUNT_PARITY_RULES) {
    const described = rule.countLines(card.descriptionLines);
    const actual = rule.countEffects(flat, chanceFlat);
    if (described !== actual) {
      issues.push(
        cardIssue(
          "error",
          card.id,
          `${rule.label} description count ${described} does not match effect count ${actual}`,
        ),
      );
    }
  }
  return issues;
}

export function validateCardDescriptionParity(card: BattleCard): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];

  const check = checkDamageParity(card);
  if (check) issues.push(check);

  issues.push(...checkRuleParity(card));

  for (const presence of PRESENCE_PARITY_CHECKS) {
    if (presence.hasEffect(card) && !presence.hasText(card)) issues.push(cardIssue("error", card.id, presence.message));
  }

  const buff = checkBuffCompanionParity(card);
  if (buff) issues.push(buff);

  issues.push(...checkTagWarnings(card));

  return [...issues, ...validateCardNumericParity(card)];
}
