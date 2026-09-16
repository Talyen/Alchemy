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
  isPerManaBlockLine,
  isRandomDrawLine,
  isRemoveEnemyArmorLine,
  isRemoveHarmfulStatusLine,
  isRestoreManaLine,
  isWishLine,
} from "./line-classifiers";
import { validateCardNumericParity } from "./numeric-parity";

interface CountParityRule {
  label: string;
  countLines: (lines: string[]) => number;
  countEffects: (effects: BattleCardEffect[]) => number;
}

function statusParityRule(status: "armor" | "forge" | "thorns", name: string): CountParityRule {
  return {
    label: status,
    countLines: (lines) => lines.filter((line) => isGainStatusLine(line, name)).length,
    countEffects: (effects) =>
      flattenChanceEffects(effects).filter((effect) => effect.kind === "player-status" && effect.status === status)
        .length,
  };
}

const COUNT_PARITY_RULES: CountParityRule[] = [
  {
    label: "heal",
    countLines: (lines) => lines.filter(isHealLine).length,
    countEffects: (effects) => countByKind(effects, "heal"),
  },
  {
    label: "restore-mana",
    countLines: (lines) => lines.filter(isRestoreManaLine).length,
    countEffects: (effects) => countByKind(effects, "restore-mana"),
  },
  {
    label: "gain-gold",
    countLines: (lines) => lines.filter(isGoldLine).length,
    countEffects: (effects) => countByKind(effects, "gain-gold"),
  },
  {
    label: "wish",
    countLines: (lines) => lines.filter(isWishLine).length,
    countEffects: (effects) => countByKind(effects, "wish"),
  },
  {
    label: "remove-harmful-status",
    countLines: (lines) => lines.filter(isRemoveHarmfulStatusLine).length,
    countEffects: (effects) => countByKind(effects, "remove-harmful-status"),
  },
  {
    label: "lose-max-mana",
    countLines: (lines) => lines.filter(isLoseMaxManaLine).length,
    countEffects: (effects) => countByKind(effects, "lose-max-mana"),
  },
  {
    label: "gain-max-mana",
    countLines: (lines) => lines.filter(isGainMaxManaLine).length,
    countEffects: (effects) => countByKind(effects, "gain-max-mana"),
  },
  {
    label: "lose-health",
    countLines: (lines) => lines.filter(isLoseHealthLine).length,
    countEffects: (effects) => countByKind(effects, "lose-health"),
  },
  {
    label: "draw-cards",
    countLines: (lines) => lines.filter(isDrawLine).length,
    countEffects: (effects) => countByKind(effects, "draw-cards"),
  },
  // "Roll a six-sided die" and "Draw that many cards" co-occur with a single
  // random-draw effect: both rules compare against the same effect count, so a
  // card with only one of the two lines fails with a count mismatch.
  {
    label: "random-draw",
    countLines: (lines) => lines.filter(isRandomDrawLine).length,
    countEffects: (effects) => countByKind(effects, "random-draw"),
  },
  {
    label: "random-draw die",
    countLines: (lines) => lines.filter(isDieRollLine).length,
    countEffects: (effects) => countByKind(effects, "random-draw"),
  },
  {
    label: "companion-action",
    countLines: (lines) => lines.filter(isCompanionActionLine).length,
    countEffects: (effects) => countByKind(effects, "companion-action"),
  },
  {
    label: "remove-enemy-armor",
    countLines: (lines) => lines.filter(isRemoveEnemyArmorLine).length,
    countEffects: (effects) => countByKind(effects, "remove-enemy-armor"),
  },
  {
    label: "multiply-enemy-status",
    countLines: (lines) => lines.filter(isDoubleLine).length,
    countEffects: (effects) => countByKind(effects, "multiply-enemy-status"),
  },
  {
    label: "remove-player-status",
    countLines: (lines) => lines.filter(isCleanseLine).length,
    countEffects: (effects) =>
      countByKind(effects, "remove-player-status") + countByKind(effects, "cleanse-player-status-to-damage"),
  },
  {
    label: "block",
    countLines: (lines) => lines.filter(isBlockLine).length,
    countEffects: (effects) =>
      flattenChanceEffects(effects).filter(
        (effect) =>
          effect.kind === "player-status" &&
          effect.status === "block" &&
          effect.perManaCrystal === undefined &&
          effect.convertCurrentMana === undefined,
      ).length,
  },
  {
    label: "convert-mana block",
    countLines: (lines) => lines.filter(isConvertManaBlockLine).length,
    countEffects: (effects) =>
      flattenChanceEffects(effects).filter(
        (effect) =>
          effect.kind === "player-status" && effect.status === "block" && effect.convertCurrentMana !== undefined,
      ).length,
  },
  {
    label: "per-mana block",
    countLines: (lines) => lines.filter(isPerManaBlockLine).length,
    countEffects: (effects) =>
      flattenChanceEffects(effects).filter(
        (effect) => effect.kind === "player-status" && effect.status === "block" && effect.perManaCrystal !== undefined,
      ).length,
  },
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
      if (!line.startsWith("Deal ") || line.includes("equal to") || line.toLowerCase().includes("random")) {
        return count;
      }
      return count + (line.includes("twice") ? 2 : 1);
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

function checkHasteParity(card: BattleCard): ContentValidationIssue | null {
  const { effects, descriptionLines } = card;
  if (
    effects.some((effect) => effect.kind === "player-status" && effect.status === "haste") &&
    !descriptionLines.some((line) => line.includes("extra turn"))
  ) {
    return cardIssue("error", card.id, "Haste effect is missing extra-turn description text");
  }
  return null;
}

function checkPhoenixFeatherParity(card: BattleCard): ContentValidationIssue | null {
  const { effects, descriptionLines } = card;
  if (
    flattenEffects(effects).some((effect) => effect.kind === "player-status" && effect.status === "phoenixFeather") &&
    !descriptionLines.some((line) => line.includes("die") || line.includes("30%"))
  ) {
    return cardIssue("error", card.id, "Phoenix Feather effect is missing revive description text");
  }
  return null;
}

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

function checkLifestealParity(card: BattleCard): ContentValidationIssue | null {
  if (!hasLifesteal(card.effects)) return null;
  if (!card.descriptionLines.some((line) => line === "Leech")) {
    return cardIssue("warning", card.id, "Lifesteal effect is missing Leech description line");
  }
  return null;
}

function checkArcheryTagParity(card: BattleCard): ContentValidationIssue | null {
  const hasArcheryTag = card.tags?.includes("archery");
  const hasArcheryLine = card.descriptionLines.some((line) => line === "Archery");
  if (hasArcheryTag && !hasArcheryLine) {
    return cardIssue("warning", card.id, "Archery tag is missing Archery description line");
  }
  if (hasArcheryLine && !hasArcheryTag) {
    return cardIssue("warning", card.id, "Archery description line is missing archery tag");
  }
  return null;
}

function checkConsumeParity(card: BattleCard): ContentValidationIssue | null {
  if (card.consume !== true) return null;
  const hasConsume = card.descriptionLines.some((line) => line === "Consume");
  const hasCompanion =
    hasKind(card.effects, "summon-companion") && card.descriptionLines.some((line) => line === "Companion");
  if (!hasConsume && !hasCompanion) {
    return cardIssue("warning", card.id, "consume:true is missing Consume or Companion description line");
  }
  return null;
}

function checkCompanionParity(card: BattleCard): ContentValidationIssue | null {
  if (!hasKind(card.effects, "summon-companion")) return null;
  if (!card.descriptionLines.some((line) => line.includes("Companion"))) {
    return cardIssue("warning", card.id, "summon-companion effect is missing Companion description line");
  }
  return null;
}

function checkRuleParity(card: BattleCard): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  for (const rule of COUNT_PARITY_RULES) {
    const described = rule.countLines(card.descriptionLines);
    const actual = rule.countEffects(card.effects);
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
