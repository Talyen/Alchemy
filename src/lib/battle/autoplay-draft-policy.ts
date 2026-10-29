import type { BattleCardEffect } from "@/lib/game-data";
import { AUTOPLAY_EFFECT_SCORE } from "./autoplay-weights";
import { isDeeplyFrozenData } from "@/lib/immutable-data";

const nominalValues = new WeakMap<readonly BattleCardEffect[], { damage: number; defense: number }>();
const NO_VALUE = { damage: 0, defense: 0 };

/** Stateless drafting estimates authored value; it never fabricates a battle snapshot. */
export function nominalCardValue(effects: readonly BattleCardEffect[]): { damage: number; defense: number } {
  const cached = nominalValues.get(effects);
  if (cached) return { ...cached };
  let damage = 0;
  let defense = 0;
  for (const effect of effects) {
    if (effect.kind === "chance" || effect.kind === "repeat-over-turns") {
      const success = nominalCardValue(effect.kind === "chance" ? effect.successEffects : effect.effects);
      const failure = effect.kind === "chance" ? nominalCardValue(effect.failureEffects) : NO_VALUE;
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
      if (effect.statusPool) {
        let defensiveStatuses = 0;
        for (const status of effect.statusPool) {
          if (status === "block" || status === "armor") defensiveStatuses++;
        }
        defense += (amount * defensiveStatuses) / effect.statusPool.length;
      } else defense += amount * Number(effect.status === "block" || effect.status === "armor");
    } else if (effect.kind === "remove-harmful-status") defense += (effect.amount ?? 1) * AUTOPLAY_EFFECT_SCORE.cleanse;
    else if (effect.kind === "remove-player-status") defense += AUTOPLAY_EFFECT_SCORE.cleanse;
    else if (effect.kind === "dodge-next-attack") defense += effect.probability ?? 1;
  }
  const result = { damage, defense };
  if (isDeeplyFrozenData(effects)) nominalValues.set(effects, { ...result });
  return result;
}
