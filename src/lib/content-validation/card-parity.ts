import { type BattleCard } from "@/lib/game-data";
import type { ContentValidationIssue } from "./types";
import {
  countByKind,
  countLinesStartingWith,
  flattenEffects,
  hasKind,
  hasLifesteal,
  hasNonStandardDamageEffects,
} from "./card-parity/helpers";
import { COUNT_PARITY_RULES } from "./card-parity/count-rules";
import { validateCardNumericParity } from "./card-parity/numeric-parity";

export { validateEnemyTraitDescriptionParity } from "./card-parity/enemy-trait-parity";
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
