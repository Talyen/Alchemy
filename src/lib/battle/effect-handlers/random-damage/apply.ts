import { DAMAGE_TYPES } from "@/lib/game-data";
import { dealDamageToEnemy } from "../../damage";
import { getBattleRng } from "../../status-helpers";
import type { EffectHandler } from "../handler-types";

export const applyRandomDamageEffect: EffectHandler = (state, card, effect, _potionMult, combatTexts) => {
  if (effect.kind !== "random-damage") return state;
  const rng = getBattleRng(state);
  const damageType = DAMAGE_TYPES[Math.trunc(rng() * DAMAGE_TYPES.length)]!;
  const span = effect.maxAmount - effect.minAmount + 1;
  const amount = effect.minAmount + Math.trunc(rng() * span);
  return dealDamageToEnemy(state, card, { kind: "damage", damageType, amount }, combatTexts);
};
