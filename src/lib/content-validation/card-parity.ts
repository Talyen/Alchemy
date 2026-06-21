import { type BattleCard, type BattleCardEffect, type BestiaryEntry } from "@/lib/game-data";
import type { ContentValidationIssue } from "./types";

export function flattenEffects(effects: BattleCardEffect[]): BattleCardEffect[] {
  return effects.flatMap((effect) =>
    effect.kind === "chance"
      ? [...flattenEffects(effect.successEffects), ...flattenEffects(effect.failureEffects)]
      : [effect],
  );
}

export function countByKind(effects: BattleCardEffect[], kind: string): number {
  return flattenEffects(effects).filter((effect) => effect.kind === kind).length;
}

export function hasKind(effects: BattleCardEffect[], kind: string): boolean {
  return flattenEffects(effects).some((effect) => effect.kind === kind);
}

export function hasLifesteal(effects: BattleCardEffect[]): boolean {
  return flattenEffects(effects).some((effect) => effect.kind === "damage" && effect.lifesteal === true);
}

export function hasEqualToBlockOrArmor(effects: BattleCardEffect[]): boolean {
  return effects.some(
    (effect) =>
      effect.kind === "damage" &&
      (effect.equalToBlock === true || effect.equalToArmor === true || effect.equalToGoldPercent !== undefined),
  );
}

export function hasNonStandardDamageEffects(effects: BattleCardEffect[]): boolean {
  const flat = flattenEffects(effects);
  return (
    hasEqualToBlockOrArmor(flat) ||
    flat.some((effect) => effect.kind === "cleanse-player-status-to-damage" || effect.kind === "random-damage") ||
    effects.some((effect) => effect.kind === "chance")
  );
}

export function countLinesStartingWith(lines: string[], prefix: string): number {
  return lines.filter((line) => line.startsWith(prefix)).length;
}

export function countHealLines(lines: string[]): number {
  return lines.filter(
    (line) =>
      line.startsWith("Heal ") ||
      (line.startsWith("Restore ") && line.includes("Health")) ||
      (line.startsWith("Gain ") && line.includes("Health")),
  ).length;
}

export function parseLeadingNumber(line: string, prefix: string): number | null {
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
  let damageIndex = 0;
  let playerStatusIndex = 0;
  let healIndex = 0;
  let restoreManaIndex = 0;
  let goldIndex = 0;
  let wishIndex = 0;
  let removeHarmfulIndex = 0;

  const damageEffects = effects.filter(
    (effect): effect is Extract<BattleCardEffect, { kind: "damage" }> => effect.kind === "damage",
  );
  const playerStatusEffects = effects.filter(
    (effect): effect is Extract<BattleCardEffect, { kind: "player-status" }> => effect.kind === "player-status",
  );
  const healEffects = effects.filter(
    (effect): effect is Extract<BattleCardEffect, { kind: "heal" }> => effect.kind === "heal",
  );
  const restoreManaEffects = effects.filter(
    (effect): effect is Extract<BattleCardEffect, { kind: "restore-mana" }> => effect.kind === "restore-mana",
  );
  const goldEffects = effects.filter(
    (effect): effect is Extract<BattleCardEffect, { kind: "gain-gold" }> => effect.kind === "gain-gold",
  );
  const wishEffects = effects.filter(
    (effect): effect is Extract<BattleCardEffect, { kind: "wish" }> => effect.kind === "wish",
  );
  const removeHarmfulEffects = effects.filter(
    (effect): effect is Extract<BattleCardEffect, { kind: "remove-harmful-status" }> =>
      effect.kind === "remove-harmful-status",
  );

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
      const effect = damageEffects[damageIndex];
      if (
        !effect ||
        effect.equalToBlock ||
        effect.equalToArmor ||
        effect.equalToGoldPercent ||
        line.includes("equal to") ||
        line.toLowerCase().includes("random")
      ) {
        damageIndex++;
        continue;
      }
      damageIndex++;
      if (parseLeadingNumber(line, "Deal ") !== effect.amount) mismatch(line, effect.amount);
      continue;
    }

    if (line.startsWith("Gain ") && line.includes(" Gold")) {
      const effect = goldEffects[goldIndex];
      goldIndex++;
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
      const effect = playerStatusEffects[playerStatusIndex];
      playerStatusIndex++;
      const perManaCrystal =
        effect?.kind === "player-status" && effect.status === "block" ? effect.perManaCrystal : undefined;
      if (perManaCrystal !== undefined && parseLeadingNumber(line, "Gain ") !== perManaCrystal)
        mismatch(line, perManaCrystal);
      continue;
    }

    if (line.startsWith("Gain ") && (line.includes(" Block") || line.includes(" Armor") || line.includes(" Forge"))) {
      const effect = playerStatusEffects[playerStatusIndex];
      playerStatusIndex++;
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
      const effect = healEffects[healIndex];
      healIndex++;
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
      const effect = restoreManaEffects[restoreManaIndex];
      restoreManaIndex++;
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
      const effect = healEffects[healIndex];
      healIndex++;
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
      const effect = wishEffects[wishIndex];
      wishIndex++;
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
      const effect = removeHarmfulEffects[removeHarmfulIndex];
      removeHarmfulIndex++;
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

export function validateCardDescriptionParity(card: BattleCard): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const { effects, descriptionLines } = card;
  const dealLines = descriptionLines.filter(
    (line) => line.startsWith("Deal ") && !line.includes("equal to") && !line.toLowerCase().includes("random"),
  ).length;
  const damageEffects = countByKind(effects, "damage") + countByKind(effects, "random-damage");
  const restoreLinesCount = countLinesStartingWith(descriptionLines, "Restore ");
  const restoreHealthLines = descriptionLines.filter(
    (line) => line.startsWith("Restore ") && line.includes("Health"),
  ).length;
  const goldEffectLines =
    descriptionLines.filter((line) => (line.startsWith("Gain ") || line.startsWith("Steal ")) && line.includes("Gold"))
      .length + descriptionLines.filter((line) => line.includes(" or Gain ") && line.includes("Gold")).length;
  const removeLines = descriptionLines.filter(
    (line) => line.startsWith("Remove ") || (line.startsWith("Cleanse ") && line.includes("harmful status")),
  ).length;

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

  reportMismatch(issues, card.id, "heal", countHealLines(descriptionLines), countByKind(effects, "heal"));
  reportMismatch(
    issues,
    card.id,
    "restore-mana",
    restoreLinesCount - restoreHealthLines,
    countByKind(effects, "restore-mana"),
  );
  reportMismatch(issues, card.id, "gain-gold", goldEffectLines, countByKind(effects, "gain-gold"));
  reportMismatch(
    issues,
    card.id,
    "wish",
    countLinesStartingWith(descriptionLines, "Wish "),
    countByKind(effects, "wish"),
  );
  reportMismatch(issues, card.id, "remove-harmful-status", removeLines, countByKind(effects, "remove-harmful-status"));
  reportMismatch(
    issues,
    card.id,
    "lose-max-mana",
    descriptionLines.filter((line) => line.startsWith("Lose ") && line.includes("Mana Crystal")).length,
    countByKind(effects, "lose-max-mana"),
  );
  reportMismatch(
    issues,
    card.id,
    "gain-max-mana",
    descriptionLines.filter((line) => line.includes("Maximum Mana")).length,
    countByKind(effects, "gain-max-mana"),
  );
  reportMismatch(
    issues,
    card.id,
    "lose-health",
    descriptionLines.filter((line) => line.startsWith("Lose ") && line.includes("Health")).length,
    countByKind(effects, "lose-health"),
  );
  reportMismatch(
    issues,
    card.id,
    "draw-cards",
    countLinesStartingWith(descriptionLines, "Draw "),
    countByKind(effects, "draw-cards"),
  );
  reportMismatch(
    issues,
    card.id,
    "remove-enemy-armor",
    countLinesStartingWith(descriptionLines, "Strip "),
    countByKind(effects, "remove-enemy-armor"),
  );
  reportMismatch(
    issues,
    card.id,
    "multiply-enemy-status",
    countLinesStartingWith(descriptionLines, "Double "),
    countByKind(effects, "multiply-enemy-status"),
  );
  reportMismatch(
    issues,
    card.id,
    "remove-player-status",
    descriptionLines.filter((line) => line.startsWith("Cleanse ") && !line.includes("harmful status")).length,
    countByKind(effects, "remove-player-status") + countByKind(effects, "cleanse-player-status-to-damage"),
  );
  reportMismatch(
    issues,
    card.id,
    "block",
    descriptionLines.filter(
      (line) =>
        line.startsWith("Gain ") &&
        line.includes(" Block") &&
        !line.includes("per Mana Crystal") &&
        !line.endsWith("each turn"),
    ).length,
    effects.filter(
      (effect) => effect.kind === "player-status" && effect.status === "block" && effect.perManaCrystal === undefined,
    ).length,
  );
  reportMismatch(
    issues,
    card.id,
    "per-mana block",
    descriptionLines.filter((line) => line.includes("per Mana Crystal")).length,
    effects.filter(
      (effect) => effect.kind === "player-status" && effect.status === "block" && effect.perManaCrystal !== undefined,
    ).length,
  );
  reportMismatch(
    issues,
    card.id,
    "armor",
    descriptionLines.filter((line) => line.startsWith("Gain ") && line.includes(" Armor")).length,
    effects.filter((effect) => effect.kind === "player-status" && effect.status === "armor").length,
  );
  reportMismatch(
    issues,
    card.id,
    "forge",
    descriptionLines.filter((line) => line.startsWith("Gain ") && line.includes(" Forge")).length,
    effects.filter((effect) => effect.kind === "player-status" && effect.status === "forge").length,
  );

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

export function validateEnemyTraitDescriptionParity(enemy: BestiaryEntry): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  for (const trait of enemy.traits) {
    const desc = trait.description.toLowerCase();
    switch (trait.id) {
      case "iron-hide":
        if (!/armor/.test(desc))
          issues.push({
            severity: "error",
            area: "enemies",
            id: enemy.id,
            message: `Trait "${trait.id}" description does not mention armor`,
          });
        break;
      case "rusting-carapace":
        if (!/forge/.test(desc))
          issues.push({
            severity: "error",
            area: "enemies",
            id: enemy.id,
            message: `Trait "${trait.id}" description does not mention forge`,
          });
        break;
      case "glacial-shell":
        if (!/freeze|burn/.test(desc))
          issues.push({
            severity: "error",
            area: "enemies",
            id: enemy.id,
            message: `Trait "${trait.id}" description does not mention freeze or burn`,
          });
        break;
      case "regeneration":
        if (!/health|heal/.test(desc))
          issues.push({
            severity: "error",
            area: "enemies",
            id: enemy.id,
            message: `Trait "${trait.id}" description does not mention health or heal`,
          });
        break;
      case "brittle-bones":
        if (!/holy|stun/.test(desc))
          issues.push({
            severity: "error",
            area: "enemies",
            id: enemy.id,
            message: `Trait "${trait.id}" description does not mention holy or stun`,
          });
        break;
      case "trinket-hoarder":
        if (!/burn|trinket/.test(desc))
          issues.push({
            severity: "error",
            area: "enemies",
            id: enemy.id,
            message: `Trait "${trait.id}" description does not mention burn or trinket`,
          });
        break;
      case "burn-resistance":
        if (!/burn/.test(desc))
          issues.push({
            severity: "error",
            area: "enemies",
            id: enemy.id,
            message: `Trait "${trait.id}" description does not mention burn`,
          });
        break;
      case "poison-resistance":
        if (!/poison/.test(desc))
          issues.push({
            severity: "error",
            area: "enemies",
            id: enemy.id,
            message: `Trait "${trait.id}" description does not mention poison`,
          });
        break;
      case "holy-vulnerability":
        if (!/holy/.test(desc))
          issues.push({
            severity: "error",
            area: "enemies",
            id: enemy.id,
            message: `Trait "${trait.id}" description does not mention holy`,
          });
        break;
      case "living-armor":
        if (!/bleed|armor/.test(desc))
          issues.push({
            severity: "error",
            area: "enemies",
            id: enemy.id,
            message: `Trait "${trait.id}" description does not mention bleed or armor`,
          });
        break;
      case "gold-trove":
        if (!/gold/.test(desc))
          issues.push({
            severity: "error",
            area: "enemies",
            id: enemy.id,
            message: `Trait "${trait.id}" description does not mention gold`,
          });
        break;
    }
  }
  return issues;
}
