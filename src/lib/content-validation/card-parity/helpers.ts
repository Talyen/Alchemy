import { isRecursiveBattleCardEffectKind, visitBattleCardEffects, type BattleCardEffect } from "@/lib/game-data";

// Flattening is a pure walk over shallow effect trees (a few hundred cards at
// most). No memoization: the cost is negligible and caching keyed by array
// identity never hits for freshly constructed literals in tests.
export function flattenEffects(effects: readonly BattleCardEffect[]): BattleCardEffect[] {
  const leaves: BattleCardEffect[] = [];
  visitBattleCardEffects(effects, (effect) => {
    if (!isRecursiveBattleCardEffectKind(effect.kind)) leaves.push(effect);
  });
  return leaves;
}
