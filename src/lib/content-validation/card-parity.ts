import { type BattleCard, type BattleCardEffect } from "@/lib/game-data";
import type { ContentValidationIssue } from "./types";
import {
  countByKind,
  countLinesStartingWith,
  flattenEffects,
  hasKind,
  hasLifesteal,
  hasNonStandardDamageEffects,
} from "./card-parity/helpers";
import { validateCardNumericParity } from "./card-parity/numeric-parity";

interface CountParityRule {
  label: string;
  countLines: (lines: string[]) => number;
  countEffects: (effects: BattleCardEffect[]) => number;
}

function countHealLines(lines: string[]): number {
  return lines.filter(
    (line) =>
      line.startsWith("Heal ") ||
      (line.startsWith("Restore ") && line.includes("Health")) ||
      (line.startsWith("Gain ") && line.includes("Health")),
  ).length;
}

const COUNT_PARITY_RULES: CountParityRule[] = [
  {
    label: "heal",
    countLines: (lines) => countHealLines(lines),
    countEffects: (effects) => countByKind(effects, "heal"),
  },
  {
    label: "restore-mana",
    countLines: (lines) =>
      lines.filter(
        (line) =>
          (line.includes("Restore ") || line.includes("Gain ")) &&
          line.includes("Mana") &&
          !line.includes("Health") &&
          !line.includes("Mana Crystal") &&
          !line.includes("Maximum Mana"),
      ).length,
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
        (effect) =>
          effect.kind === "player-status" &&
          effect.status === "block" &&
          effect.perManaCrystal === undefined &&
          effect.convertCurrentMana === undefined,
      ).length,
  },
  {
    label: "convert-mana block",
    countLines: (lines) => lines.filter((line) => line.includes("Convert each of your Mana into")).length,
    countEffects: (effects) =>
      effects.filter(
        (effect) =>
          effect.kind === "player-status" && effect.status === "block" && effect.convertCurrentMana !== undefined,
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

export { validateEnemyTraitDescriptionParity, TRAIT_REQUIRED_PATTERNS } from "./card-parity/enemy-trait-parity";
export { validateTrinketDescriptionParity, TRINKET_REQUIRED_PATTERNS } from "./card-parity/trinket-parity";
export { flattenEffects } from "./card-parity/helpers";

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
