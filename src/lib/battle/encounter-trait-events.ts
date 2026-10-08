import { readCombatFlag } from "./action-context";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { isNatureCard } from "./card-classification";
import type { BattleCard } from "@/lib/game-data";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { mergeCombatText } from "./combat-text-events";
import { processEnemyDamageEffect, resolvePendingBattleReactions } from "./enemy-attack-damage";
import { addEnemyMitigationWithCombatText } from "./encounter-trait-health-threshold";
import { isFreezeActiveForAspect, scaleByRoomMultiplier } from "./enemy-turn-traits";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { SEPTIC_SPLIT_CHANCE_PERCENT } from "../game-constants";
import { removePlayerArmor } from "./status-helpers";
import { applyArmorLossAttackRetaliation } from "./player-defensive-reactions";
import type { BattleState, CombatTextEvent } from "./types";
import { hasEnemyTrait } from "./encounter-trait-state";
import { isPlayerDefeated } from "./health-state";
import { setEnemyStatus } from "./status-state";
import { writeCombatFlag as setFlag } from "./action-context";

export function regrowEnemyThorns(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.flags.legacyEnemyThornsReady) return state;
  const nextState = setEnemyStatus(
    setFlag(state, "legacyEnemyThornsReady", true),
    "thorns",
    state.enemyStatuses.thorns + 1,
  );
  mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "thorns", amount: 1 });
  return nextState;
}

export function processEncounterTraitActionStart(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = hasEnemyTrait(state, "thorns") ? regrowEnemyThorns(state, combatTexts) : state;
  for (const [trait, field, amount] of [
    ["tempered", "forge", 1],
    ["plated", "armor", 1],
    ["reinforced", "block", 2],
  ] as const) {
    if (hasEnemyTrait(nextState, trait)) {
      nextState = addEnemyMitigationWithCombatText(
        recordEnemyAbilityActivation(nextState, trait),
        field,
        scaleByRoomMultiplier(nextState, amount),
        combatTexts,
      );
    }
  }
  if (hasEnemyTrait(nextState, "overgrowth")) {
    if (isFreezeActiveForAspect(nextState, "regen")) return nextState;
    nextState = recordEnemyAbilityActivation(nextState, "overgrowth");
    nextState = applyEnemyHealingWithCombatText(nextState, scaleByRoomMultiplier(nextState, 1), combatTexts);
  }
  return nextState;
}

function dealTraitDamage(
  state: BattleState,
  damageType: "physical" | "holy" | "burn" | "poison" | "bleed" | "freeze" | "stun" | "nature",
  baseAmount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  return processEnemyDamageEffect(
    state,
    { kind: "damage", damageType, amount: scaleByRoomMultiplier(state, baseAmount) },
    combatTexts,
  );
}

export function processEncounterTraitActionDamage(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  if (hasEnemyTrait(nextState, "septic")) {
    nextState = recordEnemyAbilityActivation(nextState, "septic");
    nextState = dealTraitDamage(
      nextState,
      rollPercent(SEPTIC_SPLIT_CHANCE_PERCENT, getBattleRng(nextState)) ? "poison" : "bleed",
      1,
      combatTexts,
    );
  }
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  if (hasEnemyTrait(nextState, "caustic")) {
    nextState = recordEnemyAbilityActivation(nextState, "caustic");
    nextState = dealTraitDamage(nextState, "poison", 1, combatTexts);
    if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
    let armorLost = 0;
    nextState = removePlayerArmor(nextState, scaleByRoomMultiplier(nextState, 1), combatTexts, (amount) => {
      armorLost = amount;
    });
    nextState = resolvePendingBattleReactions(
      applyArmorLossAttackRetaliation(nextState, armorLost, combatTexts),
      combatTexts,
    );
  }
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  if (hasEnemyTrait(nextState, "flesheater")) {
    nextState = recordEnemyAbilityActivation(nextState, "flesheater");
    nextState = processEnemyDamageEffect(
      nextState,
      { kind: "damage", damageType: "bleed", amount: scaleByRoomMultiplier(nextState, 1), lifesteal: true },
      combatTexts,
    );
  }
  // These riders share resolution, but their order and defeat boundary are gameplay rules.
  for (const [trait, damageType, amount] of [
    ["toxic", "poison", 1],
    ["bloodletter", "bleed", 1],
    ["combustible", "burn", 1],
    ["chilling", "freeze", 1],
    ["zealot", "holy", 2],
    ["concussive", "stun", 1],
  ] as const) {
    if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
    if (hasEnemyTrait(nextState, trait))
      nextState = dealTraitDamage(recordEnemyAbilityActivation(nextState, trait), damageType, amount, combatTexts);
  }
  return nextState;
}

export function processEncounterTraitCardAction(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  attackAttempted: boolean,
  options: { cardPlayed?: boolean } = {},
): BattleState {
  let nextState = state;
  const scale = (amount: number) => scaleByRoomMultiplier(nextState, amount);
  if (card.consume && hasEnemyTrait(nextState, "insatiable")) {
    nextState = recordEnemyAbilityActivation(nextState, "insatiable");
    nextState = { ...nextState, enemyPhysicalDamageBonus: nextState.enemyPhysicalDamageBonus + scale(1) };
  }
  if (options.cardPlayed !== false && isNatureCard(card) && hasEnemyTrait(nextState, "rooted")) {
    nextState = recordEnemyAbilityActivation(nextState, "rooted");
    nextState = addEnemyMitigationWithCombatText(nextState, "block", scale(1), combatTexts);
  }
  if (attackAttempted && nextState.enemyHealth > 0) {
    if (hasEnemyTrait(nextState, "thorns") && nextState.flags.legacyEnemyThornsReady) {
      nextState = recordEnemyAbilityActivation(nextState, "thorns");
      nextState = setEnemyStatus(
        setFlag(nextState, "legacyEnemyThornsReady", false),
        "thorns",
        Math.max(0, nextState.enemyStatuses.thorns - 1),
      );
      nextState = dealTraitDamage(nextState, "physical", 1, combatTexts);
    }
    if (hasEnemyTrait(nextState, "holy-retribution") && !readCombatFlag(nextState, "holyRetributionUsedThisTurn"))
      nextState = dealTraitDamage(
        setFlag(recordEnemyAbilityActivation(nextState, "holy-retribution"), "holyRetributionUsedThisTurn", true),
        "holy",
        1,
        combatTexts,
      );
  }
  return resolvePendingBattleReactions(nextState, combatTexts);
}

export function applyEncounterThorns(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.enemyHealth <= 0 || state.enemyStatuses.thorns <= 0) return state;
  const id = hasEnemyTrait(state, "briar-crown")
    ? "briar-crown"
    : hasEnemyTrait(state, "thornhide")
      ? "thornhide"
      : null;
  const legacyThorns = state.flags.legacyEnemyThornsReady ? 1 : 0;
  const amount = Math.max(0, state.enemyStatuses.thorns - legacyThorns);
  if (amount === 0) return state;
  return processEnemyDamageEffect(
    setEnemyStatus(id ? recordEnemyAbilityActivation(state, id) : state, "thorns", legacyThorns),
    { kind: "damage", damageType: "nature", amount },
    combatTexts,
  );
}
