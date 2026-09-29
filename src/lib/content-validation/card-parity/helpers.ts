import type { BattleCardEffect } from "@/lib/game-data";
import { effectChildren } from "@/lib/game-data";

function flattenInternal(effects: BattleCardEffect[]): BattleCardEffect[] {
  return effects.flatMap((effect) => {
    if (effect.kind === "chance" || effect.kind === "repeat-over-turns") {
      return flattenInternal(effectChildren(effect));
    }
    return [effect];
  });
}

// Flattening is a pure walk over shallow effect trees (a few hundred cards at
// most). No memoization: the cost is negligible and caching keyed by array
// identity never hits for freshly constructed literals in tests.
export function flattenEffects(effects: BattleCardEffect[]): BattleCardEffect[] {
  return flattenInternal(effects);
}
