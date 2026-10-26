import type { BattleState, CombatTextEvent, BattleResourceReward } from "./types";
import type { FollowUpHitRequest } from "./player-hit-core";
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

/** Hosts supply uncertainty and execution; this owner retains Wish eligibility and stage ordering. */
export interface WishRewardPort {
  chance: (chance: number, state: BattleState) => boolean;
  gold: BattleResourceReward;
  heal: BattleResourceReward;
  cleanse: BattleResourceReward;
  block: BattleResourceReward;
  mana: BattleResourceReward;
  draw: BattleResourceReward;
  forge: BattleResourceReward;
  armor: BattleResourceReward;
  hit: (state: BattleState, request: FollowUpHitRequest, texts: CombatTextEvent[]) => BattleState;
  burningEnemyHit: BattleResourceReward;
}

export function resolveWishRewards(
  state: BattleState,
  count: number,
  texts: CombatTextEvent[],
  port: WishRewardPort,
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
        current.gearEffects.goldOnWish > 0 && port.chance(REACTIVE_REWARD_CHANCES.wishfulAffix, current)
          ? current.gearEffects.goldOnWish
          : 0;
      const talentGold =
        current.talentEffects.goldOnWish > 0 &&
        (current.talentEffects.goldOnWishChance <= 0 || port.chance(current.talentEffects.goldOnWishChance, current))
          ? current.talentEffects.goldOnWish
          : 0;
      if (gearGold + talentGold > 0) current = port.gold(current, gearGold + talentGold, texts);
      if (current.trinketEffects.wishingWellGoldOnWish > 0)
        current = port.gold(current, current.trinketEffects.wishingWellGoldOnWish, texts);
      current = settle(current);
      if (getBattleOutcome(current) === "defeat") return current;

      const health =
        current.talentEffects.healthOnWish +
        (eligibility.playerHealth < eligibility.playerMaxHealth / HALF_DIVISOR ? current.gearEffects.healthOnWish : 0);
      if (health > 0) current = port.heal(current, health, texts);
      if (current.talentEffects.removeHarmfulStatusOnWish) current = port.cleanse(current, 1, texts);
      if (current.gearEffects.blockOnWish > 0) current = port.block(current, current.gearEffects.blockOnWish, texts);
      current = settle(current);
      if (getBattleOutcome(current) === "defeat") return current;

      const draw = Number(port.chance(current.talentEffects.wishDrawChance, current)) + current.gearEffects.drawOnWish;
      if (draw > 0) current = port.draw(current, draw, texts);
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

      current = port.hit(
        current,
        { source: "talent-fixed", damageType: "burn", amount: current.talentEffects.burnOnWish },
        texts,
      );
      if (current.gearEffects.burnOnWish > 0 && current.enemyHealth > 0 && eligibility.enemyStatuses.burn > 0)
        current = port.burningEnemyHit(current, current.gearEffects.burnOnWish, texts);
      current = settle(current);
      if (getBattleOutcome(current) === "defeat") return current;
      if (current.gearEffects.freezeOnWish > 0)
        current = port.hit(
          current,
          { source: "player-follow-up", damageType: "freeze", amount: current.gearEffects.freezeOnWish },
          texts,
        );
      current = settle(current);
      if (getBattleOutcome(current) === "defeat") return current;
      if (eligibility.mana === 0 && current.gearEffects.manaOnWish > 0)
        current = port.mana(current, current.gearEffects.manaOnWish, texts);
      if (current.talentEffects.wishTrinketChoice && port.chance(REACTIVE_REWARD_CHANCES.wishfulTrinket, current))
        current = port.chance(WISH_TRINKET_FORK_PERCENT, current)
          ? port.forge(current, 1, texts)
          : port.armor(current, 1, texts);
      const threshold = current.talentEffects.wishBlockBelowHealthPct;
      if (
        threshold > 0 &&
        current.talentEffects.wishBlockAmount > 0 &&
        eligibility.playerHealth < (eligibility.playerMaxHealth * threshold) / PERCENT_DENOMINATOR
      )
        current = port.block(current, current.talentEffects.wishBlockAmount, texts);
      return current;
    },
    reactions,
  );
}
