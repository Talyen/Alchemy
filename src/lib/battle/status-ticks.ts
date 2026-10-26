import { applyElementalReactionDamage } from "./elemental-reactions";
import { getReactionBonus, recordWildfireTick } from "./elemental-reaction-state";
import { rollBattleChance } from "./chance-roll";
import { resolveBattleSequence } from "./battle-sequence";
import { checkHealthThresholds } from "./status-player";
import { hasEncounterBenefit } from "./encounter-trait-state";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import type { BattleState, CombatTextEvent } from "./types";
import { applyPlayerCombatDamage, playerHealthLostToDamage } from "./health-state";
import { getBattleOutcome } from "./battle-outcome";
import { setPlayerStatus } from "./status-state";
import {
  decayArmorAfterDamage,
  decayHalvedStatus,
  decayPoisonStacks,
  mitigatePlayerStatusDamage,
} from "./status-helpers";
import { POISON_GAIN_AMOUNT } from "../game-constants";
import { applyPoisonTalentRiders } from "./damage-status-riders";
import { mergeCombatText } from "./combat-text-events";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import { applyEnemyLeechHealing, resolvePendingBattleReactions } from "./enemy-attack-damage";
import { resolveFollowUpHit, tryPoisonStunProc } from "./follow-up-hit-resolution";
import { payPendingBleedLeech } from "./damage-rider-leech";
import { dealEnemyDotTick, projectEnemyDotDamage } from "./dot-resolve";
import { processContagion } from "./enemy-healing";

function emitDotCombatText(
  combatTexts: CombatTextEvent[],
  target: "enemy" | "player",
  stat: "burn" | "poison" | "bleed",
  amount: number,
) {
  mergeCombatText(combatTexts, { target, kind: "damage", stat, amount, periodic: true });
}

function tickBurn(state: BattleState, combatTexts: CombatTextEvent[], recordDamage: (amount: number) => void) {
  const damage = state.enemyStatuses.burn;
  if (damage <= 0) return state;

  const finalDamage = projectEnemyDotDamage(state, "burn");
  emitDotCombatText(combatTexts, "enemy", "burn", finalDamage);
  let nextBurn = state.enemyStatuses.burn;
  const preventsDecay =
    state.talentEffects.burnPreventDecayChance > 0 &&
    rollBattleChance(state.talentEffects.burnPreventDecayChance, state);
  if (!preventsDecay && !hasEncounterBenefit(state, "eternal-flame")) {
    nextBurn = decayHalvedStatus(nextBurn);
  }
  return dealEnemyDotTick(state, "burn", finalDamage, nextBurn, combatTexts, (next, hit) => {
    recordDamage(hit.healthDamage);
    return recordWildfireTick(next, hit.healthDamage);
  });
}

export function tickEnemyPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.poison;
  if (damage <= 0) return state;
  const finalDamage = projectEnemyDotDamage(state, "poison");
  emitDotCombatText(combatTexts, "enemy", "poison", finalDamage);
  const isFrozenPreserved = state.enemyCC.freezeSkipTurns > 0 && state.talentEffects.freezePreventsPoisonDecay;
  let nextPoison = state.enemyStatuses.poison;
  if (rollBattleChance(state.talentEffects.poisonGainChance, state)) {
    nextPoison += POISON_GAIN_AMOUNT;
  } else if (!isFrozenPreserved) {
    nextPoison = decayPoisonStacks(
      nextPoison,
      hasEncounterBenefit(state, "venomous") ? LABYRINTH_MODIFIER_CONFIG.half : 1,
    );
  }
  return dealEnemyDotTick(state, "poison", finalDamage, nextPoison, combatTexts, (nextState, hit) => {
    const afterRiders = applyPoisonTalentRiders(
      nextState,
      hit.healthDamage,
      combatTexts,
      true,
      (current, damage, texts) =>
        resolveFollowUpHit(current, { source: "talent-derived", damageType: "bleed", amount: damage }, texts),
    );
    return tryPoisonStunProc(afterRiders, finalDamage, combatTexts);
  });
}

function tickBleed(state: BattleState, combatTexts: CombatTextEvent[], recordDamage: (amount: number) => void) {
  const damage = state.enemyStatuses.bleed;
  if (damage <= 0) {
    if (state.pendingBleedLeechHealing === 0 && state.pendingCardBleedLeechHealing === 0) return state;
    return { ...state, pendingBleedLeechHealing: 0, pendingCardBleedLeechHealing: 0 };
  }

  const finalDamage = projectEnemyDotDamage(state, "bleed");

  emitDotCombatText(combatTexts, "enemy", "bleed", finalDamage);
  const healthBeforeBleed = state.enemyHealth;
  const nextBleed = state.gearEffects.bleedDecaysByHalf > 0 ? decayHalvedStatus(damage) : 0;
  return dealEnemyDotTick(state, "bleed", finalDamage, nextBleed, combatTexts, (nextState, hit) => {
    recordDamage(hit.healthDamage);
    const afterLeech = payPendingBleedLeech(healthBeforeBleed, nextState, combatTexts, true, hit.healthDamage);
    const retainedLeech = {
      ...afterLeech,
      pendingBleedLeechHealing: Math.min(nextBleed, decayHalvedStatus(state.pendingBleedLeechHealing)),
      pendingCardBleedLeechHealing: Math.min(nextBleed, decayHalvedStatus(state.pendingCardBleedLeechHealing)),
    };
    return retainedLeech;
  });
}

export function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (getBattleOutcome(state) !== null) return state;
  if (state.enemyStatuses.burn <= 0 && state.enemyStatuses.poison <= 0 && state.enemyStatuses.bleed <= 0) {
    if (state.pendingBleedLeechHealing === 0 && state.pendingCardBleedLeechHealing === 0) return state;
    return { ...state, pendingBleedLeechHealing: 0, pendingCardBleedLeechHealing: 0 };
  }
  let burnDamage = 0;
  let bleedDamage = 0;
  let consecrated = false;
  const next = resolveBattleSequence(
    state,
    ["burn", "poison", "bleed"] as const,
    combatTexts,
    (current, stat) => {
      if (stat === "burn")
        return tickBurn(current, combatTexts, (amount) => {
          burnDamage = amount;
        });
      if (stat === "poison") return tickEnemyPoison(current, combatTexts);
      // Capture the mark before the tick clears Bleed and before ordinary riders settle.
      consecrated = current.reactions.consecrated;
      const unmarked = consecrated ? { ...current, reactions: { ...current.reactions, consecrated: false } } : current;
      return tickBleed(unmarked, combatTexts, (amount) => {
        bleedDamage = amount;
      });
    },
    { kind: "each-step", settle: resolvePendingBattleReactions },
    "either-defeated",
  );
  let result = next;
  if (consecrated && bleedDamage > 0) {
    result = resolvePendingBattleReactions(
      applyElementalReactionDamage(result, { id: "consecration", damage: getReactionBonus(bleedDamage) }, combatTexts),
      combatTexts,
    );
  }
  if (burnDamage > 0 && bleedDamage > 0) {
    result = resolvePendingBattleReactions(
      applyElementalReactionDamage(
        result,
        { id: "bloodboil", damage: getReactionBonus(burnDamage, bleedDamage) },
        combatTexts,
      ),
      combatTexts,
    );
  }
  return result;
}

function dealPlayerDotTick(
  state: BattleState,
  damage: number,
  status: "burn" | "poison" | "bleed",
  nextStacks: number,
  combatTexts: CombatTextEvent[],
  applyRiders?: (state: BattleState) => BattleState,
): BattleState {
  let nextState = setPlayerStatus(
    applyPlayerCombatDamage(state, damage, "hostile", status, { ignoreMitigation: true }, combatTexts),
    status,
    nextStacks,
  );
  if (applyRiders) nextState = applyRiders(nextState);
  const healthLost = playerHealthLostToDamage(state, nextState);
  nextState = processContagion(nextState, status, healthLost, combatTexts);
  if (healthLost > 0) {
    emitDotCombatText(combatTexts, "player", status, healthLost);
  }
  const healthAfterTick = nextState.playerHealth;
  nextState = decayArmorAfterDamage(nextState, damage, "player", combatTexts);
  nextState = checkHealthThresholds(state.playerHealth, healthAfterTick, nextState, combatTexts);
  return nextState;
}

function tickPlayerBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.bleed;
  if (damage <= 0) {
    if (state.pendingEnemyBleedLeechHealing === 0) return state;
    return { ...state, pendingEnemyBleedLeechHealing: 0 };
  }
  const finalDamage = mitigatePlayerStatusDamage(state, damage, "bleed");
  const pendingLeech = state.pendingEnemyBleedLeechHealing;
  return dealPlayerDotTick(state, finalDamage, "bleed", 0, combatTexts, (nextState) => {
    const healthLost = playerHealthLostToDamage(state, nextState);
    const enemyLeechDamage = Math.min(pendingLeech, healthLost);
    let next = nextState;
    if (enemyLeechDamage > 0) {
      next = applyEnemyLeechHealing(next, enemyLeechDamage, combatTexts);
    }
    next = { ...next, pendingEnemyBleedLeechHealing: 0 };
    return next;
  });
}

function resolvePlayerEndOfTickReactions(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  // Battle completion stops crowd control; already-earned reactions still drain.
  if (getBattleOutcome(state) !== null) {
    return resolvePendingBattleReactions(state, combatTexts);
  }
  return resolvePendingBattleReactions(resolvePlayerCrowdControlTriggers(state, combatTexts), combatTexts);
}

export function tickPlayerStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.playerStatuses.burn <= 0 && state.playerStatuses.poison <= 0 && state.playerStatuses.bleed <= 0) {
    let nextState = state;
    if (nextState.pendingEnemyBleedLeechHealing !== 0) {
      nextState = { ...nextState, pendingEnemyBleedLeechHealing: 0 };
    }
    return resolvePlayerEndOfTickReactions(nextState, combatTexts);
  }
  let nextState = state;
  // Burn and Poison settle their reactions before the next tick. Bleed is
  // followed by the shared end-of-tick settlement, including crowd control.
  for (const status of ["burn", "poison"] as const) {
    const stacks = nextState.playerStatuses[status];
    if (stacks > 0) {
      nextState = dealPlayerDotTick(
        nextState,
        mitigatePlayerStatusDamage(nextState, stacks, status),
        status,
        status === "burn" ? decayHalvedStatus(stacks) : decayPoisonStacks(stacks),
        combatTexts,
      );
    }
    nextState = resolvePendingBattleReactions(nextState, combatTexts);
    if (getBattleOutcome(nextState) !== null) {
      return resolvePlayerEndOfTickReactions(nextState, combatTexts);
    }
  }
  return resolvePlayerEndOfTickReactions(tickPlayerBleed(nextState, combatTexts), combatTexts);
}
