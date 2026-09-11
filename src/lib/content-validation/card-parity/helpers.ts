import type { BattleCardEffect } from "@/lib/game-data";
import { isRecursiveBattleCardEffectKind } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";

function flattenInternal(effects: BattleCardEffect[], unwrapRepeatOverTurns: boolean): BattleCardEffect[] {
  return effects.flatMap((effect) => {
    if (effect.kind === "chance") {
      return [
        ...flattenInternal(effect.successEffects, unwrapRepeatOverTurns),
        ...flattenInternal(effect.failureEffects, unwrapRepeatOverTurns),
      ];
    }
    if (unwrapRepeatOverTurns && effect.kind === "repeat-over-turns") {
      return flattenInternal(effect.effects, unwrapRepeatOverTurns);
    }
    return [effect];
  });
}

// Flattening is memoized per input array: count parity runs ~17 rules plus
// numeric parity cursors over the same card, so without caching each rule
// re-walks the effect tree.
const flattenCache = new WeakMap<BattleCardEffect[], BattleCardEffect[]>();
const flattenChanceCache = new WeakMap<BattleCardEffect[], BattleCardEffect[]>();

export function flattenEffects(effects: BattleCardEffect[]): BattleCardEffect[] {
  const cached = flattenCache.get(effects);
  if (cached) return cached;
  const flat = flattenInternal(effects, true);
  flattenCache.set(effects, flat);
  return flat;
}

export function countByKind(effects: BattleCardEffect[], kind: string): number {
  return flattenEffects(effects).filter((effect) => effect.kind === kind).length;
}

// Chance-only flattening intentionally keeps repeat-over-turns wrappers intact.
// Block/status count rules use this variant because repeat lines use "each
// turn" wording that the block rule excludes explicitly; numeric parity cursors
// use the full flattening above. The two counts can legitimately differ.
export function flattenChanceEffects(effects: BattleCardEffect[]): BattleCardEffect[] {
  const cached = flattenChanceCache.get(effects);
  if (cached) return cached;
  const flat = flattenInternal(effects, false);
  flattenChanceCache.set(effects, flat);
  return flat;
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
    effects.some((effect) => isRecursiveBattleCardEffectKind(effect.kind))
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
