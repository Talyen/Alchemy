import { resolvePendingCinderSkinReaction } from "./enemy-attack-damage";
import {
  enemyAbilityDealsDamage,
  getEnemyAbilityCard,
  isEnemyAbilityCard,
  type BattleCard,
  type DamageType,
  type EnemyAbilityDamageEffect,
  type EnemyAbilityEffect,
} from "@/lib/game-data";
import { getBattleRng, rngInt, rollChance } from "@/lib/rng";
import {
  BANDIT_FIRST_HIT_MULTIPLIER,
  BRAWLER_PENALTY_MULTIPLIER,
  CONDITIONAL_FLAT_BONUS,
  ENEMY_ABILITY_TRAIT_REWARD,
  GIANT_SNAKE_EXTRA_BLOCK_STRIP,
  HALF_DIVISOR,
  HELLHOUND_BURN_MULTIPLIER,
  ICE_WRAITH_FROZEN_PENALTY,
  INQUISITOR_BURN_MULTIPLIER,
  OGRE_BLOCK_BREAK_MULTIPLIER,
  VAMPIRE_BLOOD_SCENT_DAMAGE,
} from "../game-constants";
import { recordEnemyAbilityActivation, recordEnemyAbilityUse, recordEnemyAttackAction } from "./battle-metrics";
import { scaleEnemyAbilityDamage } from "./battle-enemy-setup";
import { applyEnemyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { resolveEnemyAttackHit } from "./enemy-attack-hit";
import { addEnemyMitigationWithCombatText } from "./encounter-trait-health-threshold";
import { scaleByRoomMultiplier } from "./enemy-turn-traits";
import { dealPlayerTypedHit } from "./player-typed-hit";
import { applyPlayerStatusFromAttack } from "./status-player";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import {
  addEnemyStatus,
  getEnemyTraitSet,
  hasEnemyTrait,
  isPlayerDefeated,
  isStunFreezeBuildupBlocked,
  setEnemyStatus,
  setFlag,
  setPlayerStatus,
  type BattleState,
  type CombatTextEvent,
} from "./types";

interface EnemyAbilityContext {
  traitSet: ReadonlySet<string>;
  rewardedTraits: Set<string>;
  brawlerPenalty: boolean;
  vampireBonus: boolean;
  landed: boolean;
  healthDamage: number;
}

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

function applyAbilityDamage(
  state: BattleState,
  effect: EnemyAbilityDamageEffect,
  context: EnemyAbilityContext,
  combatTexts: CombatTextEvent[],
): BattleState {
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
    flatBonus += CONDITIONAL_FLAT_BONUS;
    record("dire-wolf");
  }
  if (trait("stone-golem") && state.enemyMitigation.block > 0) {
    flatBonus += CONDITIONAL_FLAT_BONUS;
    record("stone-golem");
  }
  if (trait("ice-wraith") && state.enemyStatuses.freeze > 0) {
    flatBonus -= ICE_WRAITH_FROZEN_PENALTY;
    record("ice-wraith");
  }
  if (effect.damageType === "freeze" && (trait("frost-elemental") || trait("ice-wraith"))) {
    flatBonus += scaleByRoomMultiplier(state, CONDITIONAL_FLAT_BONUS);
    record(trait("frost-elemental") ? "frost-elemental" : "ice-wraith");
  }
  const banditBonus = trait("bandit") && !state.flags.enemyFirstHitDoubleUsed;
  if (banditBonus) amountMultiplier *= BANDIT_FIRST_HIT_MULTIPLIER;
  let damage = scaleEnemyAbilityDamage(state, effect);
  if (effect.doubleIfEnemyBleeding && state.playerStatuses.bleed > 0) damage = { ...damage, amount: damage.amount * 2 };
  if (trait("blood-cultist") && effect.damageType === "bleed" && state.playerStatuses.bleed > 0) {
    flatBonus += CONDITIONAL_FLAT_BONUS;
    record("blood-cultist");
  }
  const result = resolveEnemyAttackHit(nextState, damage, combatTexts, {
    canDodge: true,
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
  context.landed ||= result.landed;
  context.healthDamage += result.healthDamage;
  if (banditBonus && result.landed) {
    nextState = recordEnemyAbilityActivation(setFlag(nextState, "enemyFirstHitDoubleUsed", true), "bandit");
  }
  if (result.healthDamage > 0) nextState = applyHitRewards(nextState, effect.damageType, context, combatTexts);
  return nextState;
}

function applyEnemyEffect(
  state: BattleState,
  effect: EnemyAbilityEffect,
  context: EnemyAbilityContext,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;
  switch (effect.kind) {
    case "chance": {
      const effects = rollChance(effect.probability, getBattleRng(state))
        ? effect.successEffects
        : effect.failureEffects;
      return effects.reduce((next, nested) => applyEnemyEffect(next, nested, context, combatTexts), state);
    }
    case "damage":
      return applyAbilityDamage(state, effect, context, combatTexts);
    case "heal":
      return applyEnemyHealingWithCombatText(state, scaleByRoomMultiplier(state, effect.amount), combatTexts);
    case "player-status": {
      const amount = scaleByRoomMultiplier(state, effect.amount);
      if (effect.status !== "thorns")
        return addEnemyMitigationWithCombatText(state, effect.status, amount, combatTexts);
      mergeCombatText(combatTexts, { target: "enemy", kind: "status", stat: "thorns", amount });
      return addEnemyStatus(state, "thorns", amount);
    }
    case "remove-enemy-armor": {
      const amount = Math.min(state.playerStatuses.armor, scaleByRoomMultiplier(state, effect.amount));
      if (amount <= 0) return state;
      mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "armor", amount });
      return setPlayerStatus(state, "armor", state.playerStatuses.armor - amount);
    }
    case "multiply-enemy-status": {
      if (isStunFreezeBuildupBlocked(state.playerCC)) return state;
      const amount = Math.round(state.playerStatuses.freeze * effect.factor);
      const nextState = setPlayerStatus(state, "freeze", amount);
      mergeCombatText(combatTexts, { target: "player", kind: "multiply", stat: "freeze", amount: effect.factor });
      return resolvePlayerCrowdControlTriggers(nextState, combatTexts);
    }
  }
}

function applyAbilityFollowups(
  state: BattleState,
  context: EnemyAbilityContext,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (context.vampireBonus) {
    nextState = recordEnemyAbilityActivation(nextState, "vampire");
    nextState = resolveEnemyAttackHit(
      nextState,
      { kind: "damage", damageType: "bleed", amount: VAMPIRE_BLOOD_SCENT_DAMAGE },
      combatTexts,
      {
        canDodge: true,
        skipTraitReactions: true,
        traitSet: context.traitSet,
        amountMultiplier: context.brawlerPenalty ? BRAWLER_PENALTY_MULTIPLIER : 1,
      },
    ).state;
  }
  for (const [traitId, status] of [
    ["fire-imp", "burn"],
    ["giant-spider", "poison"],
  ] as const) {
    if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
    if (context.healthDamage > 0 && hasEnemyTrait(nextState, traitId, context.traitSet)) {
      nextState = applyPlayerStatusFromAttack(
        recordEnemyAbilityActivation(nextState, traitId),
        {
          kind: "player-status",
          status,
          amount: ENEMY_ABILITY_TRAIT_REWARD,
        },
        combatTexts,
      );
    }
  }
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  if (context.healthDamage > 0 && hasEnemyTrait(nextState, "winter-wolf", context.traitSet)) {
    nextState = resolveEnemyAttackHit(
      recordEnemyAbilityActivation(nextState, "winter-wolf"),
      {
        kind: "damage",
        damageType: "freeze",
        amount: ENEMY_ABILITY_TRAIT_REWARD,
      },
      combatTexts,
      { canDodge: false, traitSet: context.traitSet },
    ).state;
  }
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  if (context.landed && hasEnemyTrait(nextState, "banshee", context.traitSet)) {
    const purgeTarget = (["block", "armor", "forge", "haste"] as const).find(
      (stat) => nextState.playerStatuses[stat] > 0,
    );
    if (purgeTarget) {
      nextState = setPlayerStatus(recordEnemyAbilityActivation(nextState, "banshee"), purgeTarget, 0);
      combatTexts.push({ target: "player", kind: "notice", stat: purgeTarget, text: "Purged" });
    }
  }
  if (nextState.enemyStatuses.onAttackBleed > 0) {
    const amount = nextState.enemyStatuses.onAttackBleed;
    nextState = dealPlayerTypedHit(setEnemyStatus(nextState, "onAttackBleed", 0), "bleed", amount, combatTexts);
  }
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  if (context.landed && nextState.playerStatuses.thorns > 0) {
    const amount = nextState.playerStatuses.thorns;
    nextState = dealPlayerTypedHit(setPlayerStatus(nextState, "thorns", 0), "nature", amount, combatTexts);
  }
  return nextState;
}

export function applyEnemyAbility(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]): BattleState {
  if (!isEnemyAbilityCard(card)) throw new Error(`Unsupported enemy ability: ${card.id}`);
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;
  const damaging = enemyAbilityDealsDamage(card);
  const context: EnemyAbilityContext = {
    traitSet: getEnemyTraitSet(state),
    rewardedTraits: new Set(),
    brawlerPenalty: damaging && state.flags.enemyBrawlerDamagePenalty,
    vampireBonus:
      damaging && hasEnemyTrait(state, "vampire") && state.playerHealth < state.playerMaxHealth / HALF_DIVISOR,
    landed: false,
    healthDamage: 0,
  };
  let nextState = recordEnemyAbilityUse({ ...state, lastEnemyAbilityId: card.id }, card.id);
  if (damaging) nextState = recordEnemyAttackAction(nextState);
  if (context.brawlerPenalty) nextState = setFlag(nextState, "enemyBrawlerDamagePenalty", false);
  nextState = card.effects.reduce(
    (next, effect) =>
      resolvePendingCinderSkinReaction(applyEnemyEffect(next, effect, context, combatTexts), combatTexts),
    nextState,
  );
  if (!damaging || nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  return resolvePendingCinderSkinReaction(applyAbilityFollowups(nextState, context, combatTexts), combatTexts);
}

export function processEnemyAbility(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;
  const candidates = state.currentEnemy.abilityIds.filter((id) => id !== state.lastEnemyAbilityId);
  if (candidates.length === 0) throw new Error(`Enemy has no available ability: ${state.currentEnemy.id}`);
  const id = candidates[rngInt(getBattleRng(state), candidates.length)]!;
  return applyEnemyAbility(state, getEnemyAbilityCard(id), combatTexts);
}
