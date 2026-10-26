import type { BattleState, CombatTextEvent } from "./types";
import { rollBattleChance } from "./chance-roll";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { applyDrawResult, drawFromState } from "./draw";
import {
  addGoldWithCombatText,
  applyHealingWithCombatText,
  applyHitEpilogue,
  gainManaWithCombatText,
} from "./player-rewards";
import {
  removeHarmfulPlayerStatuses,
  applyPlayerStatusEffect,
  applyArmorReward,
  applyBlockReward,
} from "./status-player";
import { applyDamageStatuses } from "./damage-status-riders";
import { getEnemyDamageMultiplier } from "./status-helpers";
import { dealEnemyScaledDamage, gearFrozenDamageMultiplier } from "./scaled-damage";
import { resolveBattleSequence, type ReactionBoundary } from "./battle-sequence";
import { getBattleOutcome } from "./battle-outcome";
import { hasEnemyTrait } from "./encounter-trait-state";
import { recordEnemyAbilityActivation } from "./battle-metrics";
import { scaleByRoomMultiplier } from "./amount-helpers";
import {
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
  REACTIVE_REWARD_CHANCES,
  WISH_TRINKET_FORK_PERCENT,
} from "../game-constants";

export function resolveWishRewards(
  state: BattleState,
  count: number,
  texts: CombatTextEvent[],
  reactions: ReactionBoundary,
): BattleState {
  return resolveBattleSequence(
    state,
    Array.from({ length: count }),
    texts,
    (current) => {
      const eligibility = current;
      const settle = (next: BattleState) => (reactions.kind === "each-step" ? reactions.settle(next, texts) : next);
      if (hasEnemyTrait(current, "jealous"))
        current = {
          ...recordEnemyAbilityActivation(current, "jealous"),
          enemyPhysicalDamageBonus: current.enemyPhysicalDamageBonus + scaleByRoomMultiplier(current, 1),
        };
      const gearGold =
        current.gearEffects.goldOnWish > 0 && rollBattleChance(REACTIVE_REWARD_CHANCES.wishfulAffix, current)
          ? current.gearEffects.goldOnWish
          : 0;
      const talentGold =
        current.talentEffects.goldOnWish > 0 &&
        (current.talentEffects.goldOnWishChance <= 0 ||
          rollBattleChance(current.talentEffects.goldOnWishChance, current))
          ? current.talentEffects.goldOnWish
          : 0;
      if (gearGold + talentGold > 0) current = addGoldWithCombatText(current, gearGold + talentGold, texts);
      if (current.trinketEffects.wishingWellGoldOnWish > 0)
        current = addGoldWithCombatText(current, current.trinketEffects.wishingWellGoldOnWish, texts);
      current = settle(current);
      if (getBattleOutcome(current) === "defeat") return current;

      const health =
        current.talentEffects.healthOnWish +
        (eligibility.playerHealth < eligibility.playerMaxHealth / HALF_DIVISOR ? current.gearEffects.healthOnWish : 0);
      if (health > 0) current = applyHealingWithCombatText(current, health, texts);
      if (current.talentEffects.removeHarmfulStatusOnWish) current = removeHarmfulPlayerStatuses(current, 1, texts);
      if (current.gearEffects.blockOnWish > 0)
        current = applyBlockReward(current, current.gearEffects.blockOnWish, texts);
      current = settle(current);
      if (getBattleOutcome(current) === "defeat") return current;

      const draw =
        Number(rollBattleChance(current.talentEffects.wishDrawChance, current)) + current.gearEffects.drawOnWish;
      if (draw > 0) current = applyDrawResult(current, drawFromState(current, draw), texts);
      current = settle(current);
      if (getBattleOutcome(current) === "defeat") return current;
      if (eligibility.hand.length === 0 && current.gearEffects.nextCardDiscountOnEmptyHandWish > 0)
        current = {
          ...current,
          flags: {
            ...current.flags,
            nextCardCostReduction:
              current.flags.nextCardCostReduction + current.gearEffects.nextCardDiscountOnEmptyHandWish,
          },
        };

      current = resolveFollowUpHit(
        current,
        { source: "talent-fixed", damageType: "burn", amount: current.talentEffects.burnOnWish },
        texts,
      );
      if (current.gearEffects.burnOnWish > 0 && current.enemyHealth > 0 && eligibility.enemyStatuses.burn > 0)
        current = applyWishBurnAgainstBurningEnemy(current, current.gearEffects.burnOnWish, texts);
      current = settle(current);
      if (getBattleOutcome(current) === "defeat") return current;
      if (current.gearEffects.freezeOnWish > 0)
        current = resolveFollowUpHit(
          current,
          { source: "player-follow-up", damageType: "freeze", amount: current.gearEffects.freezeOnWish },
          texts,
        );
      current = settle(current);
      if (getBattleOutcome(current) === "defeat") return current;
      if (eligibility.mana === 0 && current.gearEffects.manaOnWish > 0)
        current = gainManaWithCombatText(current, current.gearEffects.manaOnWish, texts, { skipFightPacing: true });
      if (current.talentEffects.wishTrinketChoice && rollBattleChance(REACTIVE_REWARD_CHANCES.wishfulTrinket, current))
        current = rollBattleChance(WISH_TRINKET_FORK_PERCENT, current)
          ? applyPlayerStatusEffect(current, { kind: "player-status", status: "forge", amount: 1 }, texts)
          : applyArmorReward(current, 1, texts);
      const threshold = current.talentEffects.wishBlockBelowHealthPct;
      if (
        threshold > 0 &&
        current.talentEffects.wishBlockAmount > 0 &&
        eligibility.playerHealth < (eligibility.playerMaxHealth * threshold) / PERCENT_DENOMINATOR
      )
        current = applyBlockReward(current, current.talentEffects.wishBlockAmount, texts);
      return current;
    },
    reactions,
  );
}

function applyWishBurnAgainstBurningEnemy(state: BattleState, amount: number, texts: CombatTextEvent[]): BattleState {
  return dealEnemyScaledDamage(state, amount, "burn", texts, {
    multiplier: getEnemyDamageMultiplier(state, "burn") * gearFrozenDamageMultiplier(state),
    riders: (damagedState, damage, events) =>
      applyHitEpilogue(
        applyDamageStatuses(
          damagedState,
          { kind: "damage", damageType: "burn", amount },
          damage,
          events,
          state.enemyHealth,
        ),
        state.enemyHealth,
        state.enemyHealth > 0,
        events,
        undefined,
        state.playerStatuses.forge >= 5,
      ),
  });
}
