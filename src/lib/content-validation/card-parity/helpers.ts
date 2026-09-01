import type { BattleCardEffect } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";

export function flattenEffects(effects: BattleCardEffect[]): BattleCardEffect[] {
  return effects.flatMap((effect) => {
    if (effect.kind === "chance") {
      return [...flattenEffects(effect.successEffects), ...flattenEffects(effect.failureEffects)];
    }
    if (effect.kind === "repeat-over-turns") {
      return flattenEffects(effect.effects);
    }
    return [effect];
  });
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

function hasEqualToBlockOrArmor(effects: BattleCardEffect[]): boolean {
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
    effects.some((effect) => effect.kind === "chance" || effect.kind === "repeat-over-turns")
  );
}

export function countLinesStartingWith(lines: string[], prefix: string): number {
  return lines.filter((line) => line.startsWith(prefix)).length;
}

export function parseLeadingNumber(line: string, prefix: string): number | null {
  if (!line.startsWith(prefix)) return null;
  const match = line.slice(prefix.length).match(/^\+?(\d+)/);
  return match ? Number(match[1]) : null;
}

export function pushMissingEffect(issues: ContentValidationIssue[], id: string, line: string): void {
  issues.push({
    severity: "error",
    area: "cards",
    id,
    message: `"${line}" has no matching effect`,
  });
}

export function pushValueMismatch(issues: ContentValidationIssue[], id: string, line: string, actual: number): void {
  issues.push({
    severity: "error",
    area: "cards",
    id,
    message: `"${line}" does not match authored amount ${actual}`,
  });
}
