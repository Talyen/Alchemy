import { createCardUtilityHandlers } from "../card-utility-resolution";
import { applyCardHealing, applyPlayerStatusEffect, checkHealthThresholds } from "../status-player";
import {
  applyHealingWithCombatText,
  applyHealOnManaGain,
  gainManaWithCombatText,
  addGoldWithCombatText,
  applyBlockReward,
  applyCleanseHeals,
  removeHarmfulPlayerStatuses,
} from "../player-rewards";
import { setPlayerStatus } from "../status-state";
import { dealSelfDamage } from "../status-helpers";
import { resolveFollowUpHit } from "../follow-up-hit-resolution";
import { mergeCombatText } from "../combat-text-events";
import { getBattleRng, pickRandom } from "@/lib/rng";

export const UTILITY_HANDLERS = createCardUtilityHandlers({
  heal: (state, amount, texts, cardHealing) =>
    cardHealing ? applyCardHealing(state, amount, texts) : applyHealingWithCombatText(state, amount, texts),
  mana: (state, amount, texts, allowOverflow) => gainManaWithCombatText(state, amount, texts, { allowOverflow }),
  manaHealing: applyHealOnManaGain,
  healthCost: (state, amount, texts) => {
    const damaged = dealSelfDamage(state, amount, "health", texts).state;
    return checkHealthThresholds(state.playerHealth, damaged.playerHealth, damaged, texts);
  },
  crystalLoss: (state, amount, texts) =>
    resolveFollowUpHit(state, { source: "talent-fixed", damageType: "burn", amount }, texts),
  status: applyPlayerStatusEffect,
  chooseStatus: (pool, state) => pickRandom(pool, getBattleRng(state)),
  cleanse: removeHarmfulPlayerStatuses,
  cleanseStatus: (state, status, texts) => {
    if (state.playerStatuses[status] <= 0) return state;
    mergeCombatText(texts, { target: "player", kind: "notice", stat: status, signal: "cleanse", text: "" });
    return applyCleanseHeals(setPlayerStatus(state, status, 0), texts);
  },
  gold: addGoldWithCombatText,
  summon: (state, texts) =>
    state.gearEffects.blockOnCompanionSummon > 0
      ? applyBlockReward(state, state.gearEffects.blockOnCompanionSummon, texts)
      : state,
});
