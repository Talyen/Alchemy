import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "./types";
import { computeCardDamageToEnemy } from "./damage-calc";
import { applyDamageRiders } from "./damage-riders";
import { tryDodgePlayerAttackPacket } from "./dodge";
import { dealPlayerTypedHit } from "./player-typed-hit";

export function dealDamageToEnemy(
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  combatTexts: CombatTextEvent[],
) {
  const dodged = tryDodgePlayerAttackPacket(state, combatTexts);
  if (dodged) {
    return dodged;
  }

  const convertToPoison = state.flags.nextHitPoison;
  const activeEffect = convertToPoison ? { ...effect, damageType: "poison" as const } : effect;
  let damageState = convertToPoison ? { ...state, flags: { ...state.flags, nextHitPoison: false } } : state;

  let packet = activeEffect;
  if (packet.damageType === "physical" && damageState.flags.nextHitPhysicalBonus > 0) {
    packet = { ...packet, amount: packet.amount + damageState.flags.nextHitPhysicalBonus };
    damageState = {
      ...damageState,
      flags: { ...damageState.flags, nextHitPhysicalBonus: 0 },
    };
  }

  const applyPartingCut = packet.damageType === "physical" && damageState.flags.nextPhysicalDealsBleed;
  if (applyPartingCut) {
    damageState = { ...damageState, flags: { ...damageState.flags, nextPhysicalDealsBleed: false } };
  }

  const { nextState, modifiedDamage } = computeCardDamageToEnemy(damageState, packet, card);
  let result = applyDamageRiders(nextState, card, packet, modifiedDamage, combatTexts);
  if (applyPartingCut && modifiedDamage > 0 && result.enemyHealth > 0) {
    result = dealPlayerTypedHit(result, "bleed", modifiedDamage, combatTexts);
  }
  return result;
}
