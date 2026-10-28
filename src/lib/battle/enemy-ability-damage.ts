import { resolveConditionalCardDamage } from "./conditional-card-damage";
import type { DamageType, EnemyAbilityDamageEffect } from "@/lib/game-data";
import { getBattleRng, pickRandom, rollChance } from "@/lib/rng";
import { HALF_DIVISOR } from "../game-constants";
import {
  BANDIT_FIRST_HIT_MULTIPLIER,
  BRAWLER_PENALTY_MULTIPLIER,
  CONDITIONAL_FLAT_BONUS,
  ENEMY_ABILITY_TRAIT_REWARD,
  GIANT_SNAKE_EXTRA_BLOCK_STRIP,
  HELLHOUND_BURN_MULTIPLIER,
  OGRE_BLOCK_BREAK_MULTIPLIER,
  SOUL_HARVEST_PURGE_CHANCE,
} from "../game-constants";
import { scalePercent } from "./amount-helpers";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { scaleEnemyAbilityDamage } from "./battle-enemy-setup";
import { applyEnemyHealingWithCombatText } from "./enemy-healing";
import { resolveEnemyAttackHit } from "./enemy-attack-hit";
import { addEnemyMitigationWithCombatText } from "./encounter-trait-health-threshold";
import { scaleByRoomMultiplier } from "./amount-helpers";
import type { BattleState, CombatTextEvent } from "./types";
import { hasEnemyTrait } from "./encounter-trait-state";
import { getBattleOutcome } from "./battle-outcome";
import { writeCombatFlag as setFlag } from "./action-context";
import { observeAttackPower } from "./resolution-observer";
import { applyNativeHitFollowups } from "./enemy-ability-followups";
import { applyBlockDepletionRewards } from "./player-rewards";
import { setPlayerStatus } from "./status-state";
import { emitDamageText } from "./combat-text-events";
import { damageEnemyHealth } from "./health-state";
import { applyHitEpilogue } from "./player-rewards";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { prepareEnemyDamage } from "./enemy-damage-mitigation";
import { addEnemyMitigation } from "./enemy-mitigation-state";

/** Scratch facts shared by the ordered effects and follow-ups of one ability. */
export interface EnemyAbilityContext {
  attackReduction: number;
  readonly brawlerPenalty: boolean;
  brawlerPenaltySpent: boolean;
  vampireBonus: boolean;
  soulHarvest: "purge" | "leech" | null;
  landed: boolean;
}

export function createEnemyAbilityContext(state: BattleState, damaging: boolean): EnemyAbilityContext {
  return {
    attackReduction: damaging
      ? state.flags.enemyAttackDamageReduction +
        (state.enemyHealth < state.enemyMaxHealth / 2 && hasEnemyTrait(state, "cowardly") ? 1 : 0)
      : 0,
    brawlerPenalty: damaging && state.flags.enemyBrawlerDamagePenalty,
    brawlerPenaltySpent: false,
    vampireBonus: false,
    soulHarvest: null,
    landed: false,
  };
}

function recordEnemyAbilityHit(context: EnemyAbilityContext, hit: { landed: boolean }): void {
  context.landed ||= hit.landed;
}

function applyHitRewards(state: BattleState, damageType: DamageType, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  const reward = (traitId: string, kind: "heal" | "block" | "armor" | "forge") => {
    if (!hasEnemyTrait(nextState, traitId) || getBattleOutcome(nextState) !== null) return;
    nextState = recordEnemyAbilityActivation(nextState, traitId);
    nextState =
      kind === "heal"
        ? applyEnemyHealingWithCombatText(nextState, ENEMY_ABILITY_TRAIT_REWARD, combatTexts, { skipFightPacing: true })
        : addEnemyMitigationWithCombatText(nextState, kind, ENEMY_ABILITY_TRAIT_REWARD, combatTexts);
  };
  if (damageType === "holy") {
    reward("zealot-enemy", "forge");
    reward("cleric", "heal");
  }
  if (damageType === "holy" || damageType === "stun") reward("paladin", "block");
  if (damageType === "stun") reward("stone-titan", "armor");
  return nextState;
}

/** Shared offensive stage; no hits, rewards, mitigation, or random selection. */
function prepareEnemyAbilityDamage(state: BattleState, effect: EnemyAbilityDamageEffect, brawlerPenalty: boolean) {
  const activatedTraits: string[] = [];
  let amountMultiplier = brawlerPenalty ? BRAWLER_PENALTY_MULTIPLIER : 1;
  let flatBonus = 0;
  const trait = (id: string) => hasEnemyTrait(state, id);
  const record = (id: string) => {
    activatedTraits.push(id);
  };
  if (trait("hellhound") && state.playerStatuses.burn > 0) {
    amountMultiplier *= HELLHOUND_BURN_MULTIPLIER;
    record("hellhound");
  }
  const flatTrait = trait("dire-wolf") && state.playerStatuses.bleed > 0 ? "dire-wolf" : null;
  if (flatTrait) {
    flatBonus += scaleByRoomMultiplier(state, CONDITIONAL_FLAT_BONUS);
    record(flatTrait);
  }
  if (trait("stone-golem") && state.enemyMitigation.block > 0) {
    flatBonus += scaleByRoomMultiplier(state, CONDITIONAL_FLAT_BONUS);
    record("stone-golem");
  }
  if (effect.damageType === "freeze" && trait("frost-elemental")) {
    flatBonus += scaleByRoomMultiplier(state, CONDITIONAL_FLAT_BONUS);
    record("frost-elemental");
  }
  if (effect.damageType === "burn" && trait("pyromancer") && state.playerStatuses.burn === 0) {
    flatBonus += scaleByRoomMultiplier(state, CONDITIONAL_FLAT_BONUS);
    record("pyromancer");
  }
  const banditBonus = trait("bandit") && !state.flags.enemyFirstHitDoubleUsed;
  if (banditBonus) amountMultiplier *= BANDIT_FIRST_HIT_MULTIPLIER;
  // Resources already contain room scaling, but still receive ability pressure
  // and difficulty bonuses like every other damaging ability.
  let resourceEffect = effect;
  if (effect.forgeBonusPercent !== undefined)
    resourceEffect = {
      ...effect,
      amount:
        Math.round(effect.amount * state.roomScalingMultiplier) +
        Math.round((state.enemyMitigation.forge * effect.forgeBonusPercent) / 100),
    };
  if (effect.equalToBlock)
    resourceEffect = {
      ...effect,
      amount: scalePercent(state.enemyMitigation.block, effect.equalToBlockPercent ?? 100),
    };
  let damage = scaleEnemyAbilityDamage(
    state,
    resourceEffect,
    effect.equalToBlock === true || effect.forgeBonusPercent !== undefined,
  );
  if (effect.doubleIfEnemyBleeding && state.playerStatuses.bleed > 0) damage = { ...damage, amount: damage.amount * 2 };
  if (trait("blood-cultist") && effect.damageType === "bleed" && state.playerStatuses.bleed > 0) {
    flatBonus += scaleByRoomMultiplier(state, CONDITIONAL_FLAT_BONUS);
    record("blood-cultist");
  }
  return { damage, amountMultiplier, flatBonus, banditBonus, activatedTraits };
}

export function applyAbilityDamage(
  state: BattleState,
  effect: EnemyAbilityDamageEffect,
  context: EnemyAbilityContext,
  combatTexts: CombatTextEvent[],
): BattleState {
  context.vampireBonus = state.playerHealth < state.playerMaxHealth / HALF_DIVISOR && hasEnemyTrait(state, "vampire");
  context.soulHarvest =
    state.enemyHealth < state.enemyMaxHealth / HALF_DIVISOR && hasEnemyTrait(state, "soul-harvest")
      ? rollChance(SOUL_HARVEST_PURGE_CHANCE, getBattleRng(state))
        ? "purge"
        : "leech"
      : null;
  state = applyHitPilfer(state, combatTexts);
  if (getBattleOutcome(state) !== null) return state;
  // A Chance ability can resolve only utility. Spend the penalty on its first
  // damage effect, retaining the captured multiplier for all hits of this ability.
  if (context.brawlerPenalty && !context.brawlerPenaltySpent) {
    context.brawlerPenaltySpent = true;
    state = setFlag(state, "enemyBrawlerDamagePenalty", false);
  }
  const condemn = state.playerHealth < state.playerMaxHealth / HALF_DIVISOR && hasEnemyTrait(state, "inquisitor");
  // Purge is an additional trait reward; it cannot revoke the ability's own Leech.
  if (context.soulHarvest === "leech") effect = { ...effect, lifesteal: true };
  effect = resolveConditionalCardDamage(effect, state.playerCC.freezeSkipTurns > 0);
  if (effect.damageTypePool) {
    effect = { ...effect, damageType: pickRandom(effect.damageTypePool, getBattleRng(state)) ?? effect.damageType };
  }
  const { damage, amountMultiplier, flatBonus, banditBonus, activatedTraits } = prepareEnemyAbilityDamage(
    state,
    effect,
    context.brawlerPenalty,
  );
  if (effect.spendBlock && effect.equalToBlock) {
    const block = state.enemyMitigation.block;
    const spent = Math.min(block, Math.max(0, scalePercent(block, effect.equalToBlockPercent ?? 100)));
    state = addEnemyMitigation(state, "block", -spent);
    if (spent > 0) emitDamageText(combatTexts, "enemy", "block", spent, { impact: false, feedback: "secondary" });
  }
  if (state.observer)
    observeAttackPower(
      state,
      effect,
      prepareEnemyDamage(state, damage, {
        amountMultiplier,
        flatBonus,
        ignorePlayerMitigation: true,
      }).attemptedDamage,
    );
  let nextState = state;
  for (const id of activatedTraits) nextState = recordEnemyAbilityActivation(nextState, id);
  const trait = (id: string) => hasEnemyTrait(nextState, id);
  const reduction = Math.min(
    context.attackReduction,
    prepareEnemyDamage(nextState, damage, { amountMultiplier, flatBonus }).attemptedDamage,
  );
  context.attackReduction -= reduction;
  const result = resolveEnemyAttackHit(nextState, damage, combatTexts, {
    flatReduction: reduction,
    canDodge: true,
    ignoreArmor: effect.ignoreArmor === true,
    ignoreBlock: effect.ignoreBlock === true,
    amountMultiplier,
    flatBonus,
    ...(trait("ogre") && effect.damageType === "physical"
      ? { physicalBlockBreakMultiplier: OGRE_BLOCK_BREAK_MULTIPLIER }
      : {}),
    ...(trait("giant-snake") && effect.damageType === "poison"
      ? { extraPoisonBlockStrip: GIANT_SNAKE_EXTRA_BLOCK_STRIP }
      : {}),
  });
  nextState = result.state;
  if (context.soulHarvest === "leech" && result.resolvedDamage > 0)
    nextState = recordEnemyAbilityActivation(nextState, "soul-harvest");
  recordEnemyAbilityHit(context, result);
  if (banditBonus && result.landed) {
    nextState = recordEnemyAbilityActivation(setFlag(nextState, "enemyFirstHitDoubleUsed", true), "bandit");
  }
  if (result.landed && getBattleOutcome(nextState) === null) {
    nextState = applyHitRewards(nextState, effect.damageType, combatTexts);
    if (condemn && getBattleOutcome(nextState) === null) {
      nextState = resolveEnemyAttackHit(
        recordEnemyAbilityActivation(nextState, "inquisitor"),
        { kind: "damage", damageType: "holy", amount: 1 },
        combatTexts,
        { canDodge: false },
      ).state;
    }
    nextState = applyNativeHitFollowups(nextState, context, true, combatTexts);
  }
  if (result.landed && getBattleOutcome(nextState) === null && hasEnemyTrait(nextState, "self-sacrifice")) {
    const before = nextState.enemyHealth;
    nextState = damageEnemyHealth(recordEnemyAbilityActivation(nextState, "self-sacrifice"), 1).state;
    emitDamageText(combatTexts, "enemy", "health", 1);
    nextState = applyHitEpilogue(nextState, before, before > 0, combatTexts);
  }
  return nextState;
}

function applyHitPilfer(state: BattleState, texts: CombatTextEvent[]): BattleState {
  if (state.playerStatuses.block <= 0 || !hasEnemyTrait(state, "pilfer")) return state;
  let next = setPlayerStatus(state, "block", state.playerStatuses.block - 1);
  next = recordEnemyAbilityActivation(addEnemyMitigationWithCombatText(next, "block", 1, texts), "pilfer");
  emitDamageText(texts, "player", "block", 1, { impact: false });
  return resolvePendingBattleReactions(applyBlockDepletionRewards(state, next, texts), texts);
}
