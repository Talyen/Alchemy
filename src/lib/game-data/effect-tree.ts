import type { BattleCardEffect } from "./types";

/** Visit wrappers before their children in card order; returning true stops the entire walk. */
export function visitBattleCardEffects(
  effects: readonly BattleCardEffect[],
  visit: (effect: BattleCardEffect) => boolean | void,
): boolean {
  for (const effect of effects) {
    if (visit(effect)) return true;
    if (effect.kind === "chance") {
      if (visitBattleCardEffects(effect.successEffects, visit) || visitBattleCardEffects(effect.failureEffects, visit))
        return true;
    } else if (effect.kind === "repeat-over-turns" && visitBattleCardEffects(effect.effects, visit)) return true;
  }
  return false;
}

function mapChildrenIfChanged(
  children: BattleCardEffect[],
  map: (child: BattleCardEffect, index: number) => BattleCardEffect,
  offset = 0,
): BattleCardEffect[] {
  let changed: BattleCardEffect[] | undefined;
  children.forEach((child, index) => {
    const mapped = map(child, index + offset);
    if (mapped !== child && !changed) changed = children.slice();
    if (changed) changed[index] = mapped;
  });
  return changed ?? children;
}

/** Map one level; ownership copies can opt out of reusing unchanged wrappers. */
export function mapEffectChildren(
  effect: BattleCardEffect,
  map: (child: BattleCardEffect, index: number) => BattleCardEffect,
  reuseUnchanged = true,
): BattleCardEffect {
  if (effect.kind === "chance") {
    const successEffects = reuseUnchanged
      ? mapChildrenIfChanged(effect.successEffects, map)
      : effect.successEffects.map(map);
    const failureEffects = reuseUnchanged
      ? mapChildrenIfChanged(effect.failureEffects, map, effect.successEffects.length)
      : effect.failureEffects.map((child, index) => map(child, effect.successEffects.length + index));
    if (reuseUnchanged && successEffects === effect.successEffects && failureEffects === effect.failureEffects)
      return effect;
    return {
      ...effect,
      successEffects: successEffects === effect.successEffects ? successEffects.slice() : successEffects,
      failureEffects: failureEffects === effect.failureEffects ? failureEffects.slice() : failureEffects,
    };
  }
  if (effect.kind === "repeat-over-turns") {
    const effects = reuseUnchanged ? mapChildrenIfChanged(effect.effects, map) : effect.effects.map(map);
    return reuseUnchanged && effects === effect.effects ? effect : { ...effect, effects };
  }
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
