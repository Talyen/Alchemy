import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import { effectChildren, isRecursiveBattleCardEffectKind } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";

function flattenInternal(effects: BattleCardEffect[], unwrapRepeatOverTurns: boolean): BattleCardEffect[] {
  return effects.flatMap((effect) => {
    if (effect.kind === "chance" || (unwrapRepeatOverTurns && effect.kind === "repeat-over-turns")) {
      return flattenInternal(effectChildren(effect), unwrapRepeatOverTurns);
    }
    return [effect];
  });
}

// Flattening is a pure walk over shallow effect trees (a few hundred cards at
// most). No memoization: the cost is negligible and caching keyed by array
// identity never hits for freshly constructed literals in tests.
export function flattenEffects(effects: BattleCardEffect[]): BattleCardEffect[] {
  return flattenInternal(effects, true);
}

// Chance-only flattening intentionally keeps repeat-over-turns wrappers intact.
// Block/status count rules use this variant because repeat lines use "each
// turn" wording that the block rule excludes explicitly; numeric parity cursors
// use the full flattening above. The two counts can legitimately differ.
function flattenChanceEffects(effects: BattleCardEffect[]): BattleCardEffect[] {
  return flattenInternal(effects, false);
}

/** Single flatten per card shared by every parity check below. */
export interface CardEffectIndex {
  flat: BattleCardEffect[];
  chanceFlat: BattleCardEffect[];
  countKind: (kind: string) => number;
  hasKind: (kind: string) => boolean;
  lifesteal: boolean;
  nonStandardDamage: boolean;
}

export function indexCardEffects(effects: BattleCardEffect[]): CardEffectIndex {
  const flat = flattenEffects(effects);
  const chanceFlat = flattenChanceEffects(effects);
  const counts = new Map<string, number>();
  for (const effect of flat) counts.set(effect.kind, (counts.get(effect.kind) ?? 0) + 1);
  return {
    flat,
    chanceFlat,
    countKind: (kind) => counts.get(kind) ?? 0,
    hasKind: (kind) => counts.has(kind),
    lifesteal: flat.some((effect) => effect.kind === "damage" && effect.lifesteal === true),
    nonStandardDamage:
      flat.some(
        (effect) =>
          (effect.kind === "damage" &&
            (effect.equalToBlock === true ||
              effect.equalToArmor === true ||
              effect.equalToForge === true ||
              effect.equalToGoldPercent !== undefined)) ||
          effect.kind === "cleanse-player-status-to-damage" ||
          effect.kind === "random-damage",
      ) || effects.some((effect) => isRecursiveBattleCardEffectKind(effect.kind)),
  };
}

/** Per-kind cursors over one flattening, consumed in description-line order. */
export type EffectQueues = <T extends BattleCardEffect["kind"]>(
  kind: T,
) => Extract<BattleCardEffect, { kind: T }> | undefined;

export function createEffectQueues(flat: BattleCardEffect[]): EffectQueues {
  const byKind = new Map<string, BattleCardEffect[]>();
  for (const effect of flat) {
    const list = byKind.get(effect.kind);
    if (list) list.push(effect);
    else byKind.set(effect.kind, [effect]);
  }
  const consumed = new Map<string, number>();
  return ((kind: string) => {
    const list = byKind.get(kind) ?? [];
    const at = consumed.get(kind) ?? 0;
    consumed.set(kind, at + 1);
    return list[at];
  }) as EffectQueues;
}

export function effectParityDescriptionLines(card: BattleCard): string[] {
  return card.effects.length > 0 && card.effects.every((effect) => effect.kind === "summon-companion")
    ? card.descriptionLines.slice(1)
    : card.descriptionLines;
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
