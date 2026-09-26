import { canonicalCardDescriptionMatches, type BattleCard } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";
import { effectParityDescriptionLines, indexCardEffects, type CardEffectIndex } from "./helpers";
import { isNonStandardDealLine, parseDealLineShape } from "./line-classifiers";
import { validateCardLineParity } from "./numeric-parity";

export { TRAIT_REQUIRED_TERMS, validateEnemyTraitDescriptionParity } from "./enemy-trait-parity";
export { flattenEffects } from "./helpers";
export { validateTrinketDescriptionParity } from "./trinket-parity";

function checkDamageParity(
  card: BattleCard,
  descriptionLines: string[],
  index: CardEffectIndex,
): ContentValidationIssue | null {
  if (index.nonStandardDamage) return null;
  if (index.hasKind("self-damage")) {
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
    const damageEffects = index.countKind("damage") + index.countKind("random-damage");
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
  hasEffect: (card: BattleCard, index: CardEffectIndex) => boolean;
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
    hasEffect: (_, index) =>
      index.flat.some((effect) => effect.kind === "player-status" && effect.status === "phoenixFeather"),
    hasText: (card) => card.descriptionLines.some((line) => line.includes("die") || line.includes("30%")),
    message: "Phoenix Feather effect is missing revive description text",
  },
];

function checkBuffCompanionParity(
  card: BattleCard,
  descriptionLines: string[],
  index: CardEffectIndex,
): ContentValidationIssue | null {
  if (index.hasKind("self-damage")) return null;
  const described = descriptionLines.filter((line) => line.startsWith("Increase ")).length;
  const actual = index.countKind("buff-companion");
  if (described !== actual) {
    return cardIssue(
      "error",
      card.id,
      `buff-companion description count ${described} does not match effect count ${actual}`,
    );
  }
  return null;
}

function checkTagWarnings(card: BattleCard, index: CardEffectIndex): ContentValidationIssue[] {
  const warnings: ContentValidationIssue[] = [];
  if (index.lifesteal && !card.descriptionLines.some((line) => line === "Leech"))
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
      index.hasKind("summon-companion") && card.descriptionLines.some((line) => line === "Companion");
    if (!hasConsume && !hasCompanion)
      warnings.push(cardIssue("warning", card.id, "consume:true is missing Consume or Companion description line"));
  }
  if (index.hasKind("summon-companion") && !card.descriptionLines.some((line) => line.includes("Companion")))
    warnings.push(cardIssue("warning", card.id, "summon-companion effect is missing Companion description line"));
  return warnings;
}

export function validateCardDescriptionParity(card: BattleCard): ContentValidationIssue[] {
  if (canonicalCardDescriptionMatches(card)) return checkTagWarnings(card, indexCardEffects(card.effects));
  const issues: ContentValidationIssue[] = [];
  const index = indexCardEffects(card.effects);
  const descriptionLines = effectParityDescriptionLines(card);

  const check = checkDamageParity(card, descriptionLines, index);
  if (check) issues.push(check);

  for (const presence of PRESENCE_PARITY_CHECKS) {
    if (presence.hasEffect(card, index) && !presence.hasText(card))
      issues.push(cardIssue("error", card.id, presence.message));
  }

  const buff = checkBuffCompanionParity(card, descriptionLines, index);
  if (buff) issues.push(buff);

  issues.push(...checkTagWarnings(card, index));

  return [...issues, ...validateCardLineParity(card, descriptionLines, index)];
}
