import type { BattleCardEffect } from "@/lib/game-data";
import { AUTOPLAY_EFFECT_SCORE } from "./autoplay-weights";

/** Stateless drafting estimates authored value; it never fabricates a battle snapshot. */
export function nominalCardValue(effects: readonly BattleCardEffect[]): { damage: number; defense: number } {
  let damage = 0;
  let defense = 0;
  for (const effect of effects) {
    if (effect.kind === "chance" || effect.kind === "repeat-over-turns") {
      const success = nominalCardValue(effect.kind === "chance" ? effect.successEffects : effect.effects);
      const failure = effect.kind === "chance" ? nominalCardValue(effect.failureEffects) : { damage: 0, defense: 0 };
      const weight = effect.kind === "chance" ? effect.probability : effect.remainingTurns;
      damage += success.damage * weight + failure.damage * (1 - weight);
      defense += success.defense * weight + failure.defense * (1 - weight);
    } else if (effect.kind === "damage") {
      damage +=
        effect.equalToBlock ||
        effect.equalToArmor ||
        effect.forgeBonusPercent !== undefined ||
        effect.detonateAllBurn ||
        effect.detonateAllBleed
          ? Math.max(effect.amount, 1)
          : effect.amount;
    } else if (effect.kind === "random-damage") damage += (effect.minAmount + effect.maxAmount) / 2;
    else if (effect.kind === "cleanse-player-status-to-damage") {
      damage++;
      defense += AUTOPLAY_EFFECT_SCORE.cleanse;
    } else if (effect.kind === "heal") defense += effect.amount;
    else if (effect.kind === "player-status") {
      const amount = effect.convertCurrentMana ?? effect.perManaCrystal ?? effect.amount;
      const pool = effect.statusPool ?? [effect.status];
      defense += (amount * pool.filter((status) => status === "block" || status === "armor").length) / pool.length;
    } else if (effect.kind === "remove-harmful-status") defense += (effect.amount ?? 1) * AUTOPLAY_EFFECT_SCORE.cleanse;
    else if (effect.kind === "remove-player-status") defense += AUTOPLAY_EFFECT_SCORE.cleanse;
    else if (effect.kind === "dodge-next-attack") defense++;
  }
  return { damage, defense };
}
