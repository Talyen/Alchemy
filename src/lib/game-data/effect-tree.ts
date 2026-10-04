import type { BattleCardEffect } from "./types";

/** Stable child order also defines Corruption effect paths: success, then failure. */
export function effectChildren(effect: BattleCardEffect): BattleCardEffect[] {
  if (effect.kind === "chance") return [...effect.successEffects, ...effect.failureEffects];
  if (effect.kind === "repeat-over-turns") return effect.effects;
  return [];
}

/** Visit wrappers before their children in card order; returning true stops the entire walk. */
export function visitBattleCardEffects(
  effects: readonly BattleCardEffect[],
  visit: (effect: BattleCardEffect) => boolean | void,
): boolean {
  for (const effect of effects) {
    if (visit(effect) || visitBattleCardEffects(effectChildren(effect), visit)) return true;
  }
  return false;
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

function equalEffectValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => equalEffectValue(value, b[index]))
    );
  }
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        equalEffectValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}

/** Compare effect payloads, including ordered pools and branches, independent of object field order. */
export function areBattleCardEffectsEqual(a: BattleCardEffect, b: BattleCardEffect): boolean {
  return a.kind === b.kind && equalEffectValue(a, b);
}
