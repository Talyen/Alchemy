import { cardHealingAmount, createCardUtilityHandlers } from "../card-utility-resolution";
import { applyCardHealing, applyPlayerStatusEffect, checkHealthThresholds } from "../status-player";
import {
  applyHealingWithCombatText,
  applyManaGainRewards,
  gainManaWithCombatText,
  addGoldWithCombatText,
  applyBlockReward,
  applyCleanseHeals,
  removeHarmfulPlayerStatuses,
} from "../player-rewards";
import { setPlayerStatus } from "../status-state";
import { dealSelfDamage } from "../status-helpers";
import { resolveFollowUpHit } from "../follow-up-hit-resolution";
import { emitNoticeText } from "../combat-text-events";
import { getBattleRng, pickRandom } from "@/lib/rng";

export const UTILITY_HANDLERS = createCardUtilityHandlers({
  healingAmount: cardHealingAmount,
  heal: (state, amount, texts, cardHealing, feedback) =>
    cardHealing
      ? applyCardHealing(state, amount, texts, { feedback })
      : applyHealingWithCombatText(state, amount, texts, { feedback }),
  mana: (state, amount, texts, allowOverflow, feedback) =>
    gainManaWithCombatText(state, amount, texts, { allowOverflow, feedback }),
  manaGainRewards: applyManaGainRewards,
  healthCost: (state, amount, texts) => {
    const damaged = dealSelfDamage(state, amount, "health", texts).state;
    return checkHealthThresholds(state.playerHealth, damaged.playerHealth, damaged, texts);
  },
  crystalLoss: (state, amount, texts) =>
    resolveFollowUpHit(state, { source: "talent-fixed", damageType: "burn", amount }, texts),
  status: (state, effect, texts, feedback) => applyPlayerStatusEffect(state, effect, texts, { feedback }),
  chooseStatus: (pool, state) => pickRandom(pool, getBattleRng(state)),
  cleanse: (state, amount, texts, feedback) => removeHarmfulPlayerStatuses(state, amount, texts, { feedback }),
  cleanseStatus: (state, status, texts, feedback) => {
    if (state.playerStatuses[status] <= 0) return state;
    emitNoticeText(texts, "player", status, "", { signal: "cleanse", ...(feedback ? { feedback } : {}) });
    return applyCleanseHeals(setPlayerStatus(state, status, 0), texts);
  },
  gold: (state, amount, texts, feedback) => addGoldWithCombatText(state, amount, texts, { feedback }),
  summon: (state, texts) =>
    state.gearEffects.blockOnCompanionSummon > 0
      ? applyBlockReward(state, state.gearEffects.blockOnCompanionSummon, texts)
      : state,
});
