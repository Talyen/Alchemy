import type { BattleCardEffect } from "./types";

/** Stable child order also defines saved corruption target paths: success, then failure. */
export function effectChildren(effect: BattleCardEffect): BattleCardEffect[] {
  if (effect.kind === "chance") return [...effect.successEffects, ...effect.failureEffects];
  if (effect.kind === "repeat-over-turns") return effect.effects;
  return [];
}

/** Map one level without changing branch grouping; callers own recursion and leaf behavior. */
export function mapEffectChildren(
  effect: BattleCardEffect,
  map: (child: BattleCardEffect, index: number) => BattleCardEffect,
): BattleCardEffect {
  if (effect.kind === "chance") {
    return {
      ...effect,
      successEffects: effect.successEffects.map(map),
      failureEffects: effect.failureEffects.map((child, index) => map(child, effect.successEffects.length + index)),
    };
  }
  if (effect.kind === "repeat-over-turns") return { ...effect, effects: effect.effects.map(map) };
  return effect;
}
