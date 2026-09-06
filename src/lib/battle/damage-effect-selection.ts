import type { BattleCardEffect } from "@/lib/game-data";

export function damageOnlyEffects(effects: readonly BattleCardEffect[]): BattleCardEffect[] {
  return effects.flatMap((effect): BattleCardEffect[] => {
    if (effect.kind === "damage" || effect.kind === "random-damage") return [effect];
    if (effect.kind === "chance") {
      const successEffects = damageOnlyEffects(effect.successEffects);
      const failureEffects = damageOnlyEffects(effect.failureEffects);
      return successEffects.length || failureEffects.length ? [{ ...effect, successEffects, failureEffects }] : [];
    }
    return [];
  });
}
