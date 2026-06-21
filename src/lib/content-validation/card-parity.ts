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
  const match = line.slice(prefix.length).match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function reportMismatch(
  issues: ContentValidationIssue[],
  id: string,
  label: string,
  described: number,
  actual: number,
): void {
  if (described !== actual) {
    issues.push({
      severity: "error",
      area: "cards",
      id,
      message: `${label} description count ${described} does not match effect count ${actual}`,
    });
  }
}

function validateCardNumericParity(card: BattleCard): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const { effects, descriptionLines } = card;

  const getNext = <T extends BattleCardEffect["kind"]>(kind: T) => {
    const filtered = effects.filter((e) => e.kind === kind) as Extract<BattleCardEffect, { kind: T }>[];
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

  function mismatch(line: string, actual: number): void {
    issues.push({
      severity: "error",
      area: "cards",
      id: card.id,
      message: `"${line}" does not match authored amount ${actual}`,
    });
  }

  for (const line of descriptionLines) {
    if (line.startsWith("Deals ")) continue;

    if (line.startsWith("Deal ")) {
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
      if (parseLeadingNumber(line, "Deal ") !== effect.amount) mismatch(line, effect.amount);
      continue;
    }

    if (line.startsWith("Gain ") && line.includes(" Gold")) {
      const effect = nextGold();
      if (effect) {
        if (parseLeadingNumber(line, "Gain ") !== effect.amount) mismatch(line, effect.amount);
      } else {
        issues.push({
          severity: "error",
          area: "cards",
          id: card.id,
          message: `"${line}" has no matching gain-gold effect`,
        });
      }
      continue;
    }

    if (line.startsWith("Gain ") && line.includes(" Block") && line.includes("per Mana Crystal")) {
      const effect = nextPlayerStatus();
      const perManaCrystal = effect?.status === "block" ? effect.perManaCrystal : undefined;
      if (perManaCrystal !== undefined && parseLeadingNumber(line, "Gain ") !== perManaCrystal)
        mismatch(line, perManaCrystal);
      continue;
    }

    if (line.startsWith("Gain ") && (line.includes(" Block") || line.includes(" Armor") || line.includes(" Forge"))) {
      const effect = nextPlayerStatus();
      if (
        effect &&
        effect.status !== "haste" &&
        effect.perManaCrystal === undefined &&
        parseLeadingNumber(line, "Gain ") !== effect.amount
      ) {
        mismatch(line, effect.amount);
      }
      continue;
    }

    if (line.startsWith("Heal ")) {
      const effect = nextHeal();
      if (effect) {
        if (parseLeadingNumber(line, "Heal ") !== effect.amount) mismatch(line, effect.amount);
      } else {
        issues.push({
          severity: "error",
          area: "cards",
          id: card.id,
          message: `"${line}" has no matching heal effect`,
        });
      }
      continue;
    }

    if (line.startsWith("Restore ") && line.includes("Mana")) {
      const effect = nextRestoreMana();
      if (effect) {
        if (parseLeadingNumber(line, "Restore ") !== effect.amount) mismatch(line, effect.amount);
      } else {
        issues.push({
          severity: "error",
          area: "cards",
          id: card.id,
          message: `"${line}" has no matching restore-mana effect`,
        });
      }
      continue;
    }

    if (line.startsWith("Restore ") && line.includes("Health")) {
      const effect = nextHeal();
      if (effect) {
        if (parseLeadingNumber(line, "Restore ") !== effect.amount) mismatch(line, effect.amount);
      } else {
        issues.push({
          severity: "error",
          area: "cards",
          id: card.id,
          message: `"${line}" has no matching heal effect`,
        });
      }
      continue;
    }

    if (line.startsWith("Wish ")) {
      const effect = nextWish();
      if (effect) {
        if (parseLeadingNumber(line, "Wish ") !== effect.amount) mismatch(line, effect.amount);
      } else {
        issues.push({
          severity: "error",
          area: "cards",
          id: card.id,
          message: `"${line}" has no matching wish effect`,
        });
      }
      continue;
    }

    if ((line.startsWith("Remove ") || line.startsWith("Cleanse ")) && line.includes("harmful status")) {
      const effect = nextRemoveHarmful();
      if (effect) {
        const parsed = parseLeadingNumber(line, line.startsWith("Remove ") ? "Remove " : "Cleanse ");
        if (parsed !== effect.amount) mismatch(line, effect.amount);
      } else {
        issues.push({
          severity: "error",
          area: "cards",
          id: card.id,
          message: `"${line}" has no matching remove-harmful-status effect`,
        });
      }
    }
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

export function validateCardDescriptionParity(card: BattleCard): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const { effects, descriptionLines } = card;
  const dealLines = descriptionLines.filter(
    (line) => line.startsWith("Deal ") && !line.includes("equal to") && !line.toLowerCase().includes("random"),
  ).length;
  const damageEffects = countByKind(effects, "damage") + countByKind(effects, "random-damage");

  if (!hasNonStandardDamageEffects(effects)) {
    if (hasKind(effects, "self-damage")) {
      if (!descriptionLines.some((line) => /self|Receive/.test(line))) {
        issues.push({
          severity: "error",
          area: "cards",
          id: card.id,
          message: "Self-damage effect is missing matching description text",
        });
      }
    } else {
      reportMismatch(issues, card.id, "damage", dealLines, damageEffects);
    }
  }

  for (const rule of COUNT_PARITY_RULES) {
    reportMismatch(issues, card.id, rule.label, rule.countLines(descriptionLines), rule.countEffects(effects));
  }

  if (
    effects.some((effect) => effect.kind === "player-status" && effect.status === "haste") &&
    !descriptionLines.some((line) => line.includes("extra turn"))
  ) {
    issues.push({
      severity: "error",
      area: "cards",
      id: card.id,
      message: "Haste effect is missing extra-turn description text",
    });
  }
  if (
    flattenEffects(effects).some((effect) => effect.kind === "player-status" && effect.status === "phoenixFeather") &&
    !descriptionLines.some((line) => line.includes("die") || line.includes("30%"))
  ) {
    issues.push({
      severity: "error",
      area: "cards",
      id: card.id,
      message: "Phoenix Feather effect is missing revive description text",
    });
  }
  if (!hasKind(effects, "self-damage")) {
    reportMismatch(
      issues,
      card.id,
      "buff-companion",
      countLinesStartingWith(descriptionLines, "Increase "),
      countByKind(effects, "buff-companion"),
    );
  }
  if (hasLifesteal(effects) && !descriptionLines.some((line) => line === "Leech")) {
    issues.push({
      severity: "error",
      area: "cards",
      id: card.id,
      message: "Lifesteal effect is missing Leech description line",
    });
  }
  if (card.tags?.includes("archery") && !descriptionLines.some((line) => line === "Archery")) {
    issues.push({
      severity: "error",
      area: "cards",
      id: card.id,
      message: "Archery tag is missing Archery description line",
    });
  }
  if (descriptionLines.some((line) => line === "Archery") && !card.tags?.includes("archery")) {
    issues.push({
      severity: "error",
      area: "cards",
      id: card.id,
      message: "Archery description line is missing archery tag",
    });
  }
  if (card.consume === true) {
    const hasConsume = descriptionLines.some((line) => line === "Consume");
    const hasCompanion =
      hasKind(card.effects, "summon-companion") && descriptionLines.some((line) => line === "Companion");
    if (!hasConsume && !hasCompanion) {
      issues.push({
        severity: "error",
        area: "cards",
        id: card.id,
        message: "consume:true is missing Consume or Companion description line",
      });
    }
  }
  if (hasKind(effects, "summon-companion") && !descriptionLines.some((line) => line.includes("Companion"))) {
    issues.push({
      severity: "error",
      area: "cards",
      id: card.id,
      message: "summon-companion effect is missing Companion description line",
    });
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
