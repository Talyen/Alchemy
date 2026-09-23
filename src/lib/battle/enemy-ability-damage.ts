import { resolveConditionalCardDamage } from "./conditional-card-damage";
import { recordEnemyAbilityHit, type EnemyAbilityContext } from "./enemy-ability-context";
import { type DamageType, type EnemyAbilityDamageEffect } from "@/lib/game-data";
import { getBattleRng, pickRandom } from "@/lib/rng";
import {
  BANDIT_FIRST_HIT_MULTIPLIER,
  BRAWLER_PENALTY_MULTIPLIER,
  CONDITIONAL_FLAT_BONUS,
  ENEMY_ABILITY_TRAIT_REWARD,
  GIANT_SNAKE_EXTRA_BLOCK_STRIP,
  HELLHOUND_BURN_MULTIPLIER,
  INQUISITOR_BURN_MULTIPLIER,
  OGRE_BLOCK_BREAK_MULTIPLIER,
} from "../game-constants";
import { scalePercent } from "./amount-helpers";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { scaleEnemyAbilityDamage } from "./battle-enemy-setup";
import { applyEnemyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { resolveEnemyAttackHit } from "./enemy-attack-hit";
import { addEnemyMitigationWithCombatText } from "./encounter-trait-health-threshold";
import { scaleByRoomMultiplier } from "./enemy-turn-traits";
import { hasEnemyTrait, isPlayerDefeated, setFlag, type BattleState, type CombatTextEvent } from "./types";

function applyHitRewards(
  state: BattleState,
  damageType: DamageType,
  context: EnemyAbilityContext,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  const reward = (traitId: string, kind: "heal" | "block" | "armor" | "forge") => {
    if (
      !hasEnemyTrait(nextState, traitId, context.traitSet) ||
      context.rewardedTraits.has(traitId) ||
      nextState.enemyHealth <= 0 ||
      isPlayerDefeated(nextState)
    )
      return;
    context.rewardedTraits.add(traitId);
    nextState = recordEnemyAbilityActivation(nextState, traitId);
    nextState =
      kind === "heal"
        ? applyEnemyHealingWithCombatText(nextState, ENEMY_ABILITY_TRAIT_REWARD, combatTexts, { skipFightPacing: true })
        : addEnemyMitigationWithCombatText(nextState, kind, ENEMY_ABILITY_TRAIT_REWARD, combatTexts);
  };
  if (damageType === "holy") {
    reward("zealot-enemy", "forge");
    reward("cleric", "heal");
    reward("seraph", "heal");
  }
  if (damageType === "holy" || damageType === "stun") reward("paladin", "block");
  if (damageType === "stun") reward("stone-titan", "armor");
  return nextState;
}

export function applyAbilityDamage(
  state: BattleState,
  effect: EnemyAbilityDamageEffect,
  context: EnemyAbilityContext,
  combatTexts: CombatTextEvent[],
): BattleState {
  const selected = resolveConditionalCardDamage(effect, {
    actorBlock: state.enemyMitigation.block,
    targetBlock: state.playerStatuses.block,
    targetFrozen: state.playerCC.freezeSkipTurns > 0,
  });
  effect = selected.effect;
  if (effect.damageTypePool) {
    effect = { ...effect, damageType: pickRandom(effect.damageTypePool, getBattleRng(state)) ?? effect.damageType };
  }
  if (selected.blockSpent > 0) {
    state = {
      ...state,
      enemyMitigation: { ...state.enemyMitigation, block: state.enemyMitigation.block - selected.blockSpent },
    };
    mergeCombatText(combatTexts, {
      target: "enemy",
      kind: "damage",
      stat: "block",
      amount: selected.blockSpent,
      impact: false,
    });
  }
  let nextState = state;
  let amountMultiplier = context.brawlerPenalty ? BRAWLER_PENALTY_MULTIPLIER : 1;
  let flatBonus = 0;
  const trait = (id: string) => hasEnemyTrait(nextState, id, context.traitSet);
  const record = (id: string) => {
    nextState = recordEnemyAbilityActivation(nextState, id);
  };
  if (trait("hellhound") && state.playerStatuses.burn > 0) {
    amountMultiplier *= HELLHOUND_BURN_MULTIPLIER;
    record("hellhound");
  }
  if (trait("inquisitor") && effect.damageType === "holy" && state.playerStatuses.burn > 0) {
    amountMultiplier *= INQUISITOR_BURN_MULTIPLIER;
    record("inquisitor");
  }
  if (trait("dire-wolf") && state.playerStatuses.bleed > 0) {
    flatBonus += scaleByRoomMultiplier(state, CONDITIONAL_FLAT_BONUS);
    record("dire-wolf");
  }
  if (trait("stone-golem") && state.enemyMitigation.block > 0) {
    flatBonus += scaleByRoomMultiplier(state, CONDITIONAL_FLAT_BONUS);
    record("stone-golem");
  }
  if (effect.damageType === "freeze" && (trait("frost-elemental") || trait("ice-wraith"))) {
    flatBonus += scaleByRoomMultiplier(state, CONDITIONAL_FLAT_BONUS);
    record(trait("frost-elemental") ? "frost-elemental" : "ice-wraith");
  }
  if (effect.damageType === "burn" && trait("pyromancer")) {
    flatBonus += scaleByRoomMultiplier(state, CONDITIONAL_FLAT_BONUS);
    record("pyromancer");
  }
  const banditBonus = trait("bandit") && !state.flags.enemyFirstHitDoubleUsed;
  if (banditBonus) amountMultiplier *= BANDIT_FIRST_HIT_MULTIPLIER;
  // Resources already contain room scaling, but still receive ability pressure
  // and difficulty bonuses like every other damaging ability.
  let resourceEffect = effect;
  if (effect.equalToForge) resourceEffect = { ...effect, amount: state.enemyMitigation.forge };
  if (effect.equalToBlock)
    resourceEffect = {
      ...effect,
      amount: scalePercent(state.enemyMitigation.block, effect.equalToBlockPercent ?? 100),
    };
  let damage = scaleEnemyAbilityDamage(
    state,
    resourceEffect,
    effect.equalToForge === true || effect.equalToBlock === true,
  );
  if (effect.doubleIfEnemyBleeding && state.playerStatuses.bleed > 0) damage = { ...damage, amount: damage.amount * 2 };
  if (trait("blood-cultist") && effect.damageType === "bleed" && state.playerStatuses.bleed > 0) {
    flatBonus += scaleByRoomMultiplier(state, CONDITIONAL_FLAT_BONUS);
    record("blood-cultist");
  }
  const result = resolveEnemyAttackHit(nextState, damage, combatTexts, {
    canDodge: true,
    ignoreArmor: effect.ignoreArmor === true,
    ignoreBlock: effect.ignoreBlock === true,
    amountMultiplier,
    flatBonus,
    traitSet: context.traitSet,
    ...(trait("ogre") && effect.damageType === "physical"
      ? { physicalBlockBreakMultiplier: OGRE_BLOCK_BREAK_MULTIPLIER }
      : {}),
    ...(trait("giant-snake") && effect.damageType === "poison"
      ? { extraPoisonBlockStrip: GIANT_SNAKE_EXTRA_BLOCK_STRIP }
      : {}),
  });
  nextState = result.state;
  recordEnemyAbilityHit(context, result);
  if (banditBonus && result.landed) {
    nextState = recordEnemyAbilityActivation(setFlag(nextState, "enemyFirstHitDoubleUsed", true), "bandit");
  }
  if (result.healthDamage > 0) nextState = applyHitRewards(nextState, effect.damageType, context, combatTexts);
  return nextState;
}
