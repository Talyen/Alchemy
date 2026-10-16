import { harmfulPlayerStatusIds, type PlayerStatusId } from "@/lib/game-data";
import { HALF_DIVISOR } from "../game-constants";
import { applyPercentBonus } from "./amount-helpers";
import { mergeCombatText } from "./combat-text-events";
import { blockAmountWithForge, setPlayerStatus, addPlayerStatus } from "./status-state";
import { resolvePlayerHealing } from "./health-state";
import { writeCombatFlag as setFlag } from "./action-context";
import { gainMana, scaleGoldReward } from "./resource-state";
import { paceCombatMagnitude } from "./fight-pacing";
import type { BattleState, CombatTextEvent } from "./types";

interface PlayerResourceResolutionPort {
  chance: (chance: number, state: BattleState) => boolean;
  afterHealing: (state: BattleState, restored: number, texts?: CombatTextEvent[]) => BattleState;
  drawHoly: (state: BattleState, texts: CombatTextEvent[]) => BattleState;
  forgeReady: (texts: CombatTextEvent[]) => void;
}

/** One reward interpreter for live combat and nonrandom inspection; ports own external reactions. */
export function createPlayerResourceResolver(port: PlayerResourceResolutionPort) {
  function emitGainedStatusText(
    before: Pick<BattleState, "playerStatuses">,
    after: Pick<BattleState, "playerStatuses">,
    stat: "block" | "thorns",
    combatTexts: CombatTextEvent[],
  ) {
    const gained = after.playerStatuses[stat] - before.playerStatuses[stat];
    if (gained <= 0) return;
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat, amount: gained });
  }

  function resolveHealingWithFeedback(
    state: BattleState,
    amount: number,
    combatTexts?: CombatTextEvent[],
    allowOverhealBlock = false,
  ) {
    const healing = resolvePlayerHealing(state, amount, allowOverhealBlock);
    if (combatTexts) {
      if (healing.effective > 0) {
        mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: healing.effective });
      }
      emitGainedStatusText(state, healing.state, "block", combatTexts);
      emitGainedStatusText(state, healing.state, "thorns", combatTexts);
    }
    return healing;
  }

  function applyHealingWithCombatText(
    state: BattleState,
    amount: number,
    combatTexts?: CombatTextEvent[],
    options?: { skipFightPacing?: boolean; allowOverhealBlock?: boolean },
  ): BattleState {
    if (amount <= 0) return state;
    const healAmount = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "player");
    const healing = resolveHealingWithFeedback(state, healAmount, combatTexts, options?.allowOverhealBlock);
    const nextState = healing.state;
    const actualHeal = healing.restored;
    const reacted = applyBlockGainRewards(
      port.afterHealing(nextState, actualHeal, combatTexts),
      nextState.playerStatuses.block - state.playerStatuses.block,
      combatTexts ?? [],
    );
    return applyRestorativeCleanse(reacted, actualHeal, combatTexts);
  }

  function applyRestorativeCleanse(
    state: BattleState,
    actualHeal: number,
    combatTexts?: CombatTextEvent[],
  ): BattleState {
    return actualHeal > 0 &&
      state.gearEffects.healCleanseChance > 0 &&
      harmfulPlayerStatusIds.some((status) => state.playerStatuses[status] > 0) &&
      port.chance(state.gearEffects.healCleanseChance, state)
      ? removeHarmfulPlayerStatuses(state, 1, combatTexts)
      : state;
  }

  function applyHealOnManaGain(state: BattleState, gainAmount: number, combatTexts: CombatTextEvent[]): BattleState {
    if (gainAmount <= 0) return state;
    if (state.talentEffects.healthPerMana > 0) {
      return applyHealingWithCombatText(state, gainAmount * state.talentEffects.healthPerMana, combatTexts);
    }
    return state;
  }

  function gainManaWithCombatText(
    state: BattleState,
    amount: number,
    combatTexts?: CombatTextEvent[],
    options?: { skipFightPacing?: boolean; allowOverflow?: boolean },
  ): BattleState {
    if (amount <= 0) return state;
    const granted = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "player");
    const nextState = gainMana(state, granted, options?.allowOverflow);
    const gained = nextState.mana - state.mana;
    if (gained > 0 && combatTexts) {
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "mana", amount: gained });
    }
    return applyHealOnManaGain(nextState, gained, combatTexts ?? []);
  }

  function addPlayerStatusWithCombatText(
    state: BattleState,
    stat: PlayerStatusId,
    amount: number,
    combatTexts?: CombatTextEvent[],
    options?: { skipFightPacing?: boolean },
  ): BattleState {
    if (amount <= 0) return state;
    if (stat === "block") amount = blockAmountWithForge(state, amount);
    const before = state.playerStatuses[stat];
    const previousState = state;
    const nextState = addPlayerStatus(
      state,
      stat,
      options?.skipFightPacing || stat === "armor" ? amount : paceCombatMagnitude(state, amount, "player"),
    );
    const delta = nextState.playerStatuses[stat] - before;
    if (delta > 0 && combatTexts) {
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat, amount: delta });
    }
    if (stat === "block" && combatTexts) {
      emitGainedStatusText(previousState, nextState, "thorns", combatTexts);
    }
    return stat === "block" ? applyBlockGainRewards(nextState, delta, combatTexts ?? []) : nextState;
  }

  function addGoldWithCombatText(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]): BattleState {
    if (amount <= 0) return state;

    const gold = Math.min(Number.MAX_SAFE_INTEGER, state.gold + scaleGoldReward(amount, state.gearEffects));
    const scaledGold = gold - state.gold;
    if (scaledGold <= 0) return state;
    let nextState = { ...state, gold };
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "gold",
        amount: scaledGold,
      });
    }
    if (nextState.gearEffects.healOnCombatGoldGain > 0) {
      nextState = applyHealingWithCombatText(nextState, nextState.gearEffects.healOnCombatGoldGain, combatTexts ?? []);
    }
    return state.gearEffects.goldGrantsForgeAndHoly > 0 && port.chance(25, nextState)
      ? addForgeToPlayer(nextState, 1, combatTexts)
      : nextState;
  }

  function applyBlockReward(
    state: BattleState,
    amount: number,
    combatTexts: CombatTextEvent[],
    options?: { skipFightPacing?: boolean },
  ): BattleState {
    return addPlayerStatusWithCombatText(state, "block", amount, combatTexts, options);
  }

  function addForgeToPlayer(state: BattleState, baseAmount: number, combatTexts?: CombatTextEvent[]): BattleState {
    if (baseAmount <= 0) return state;
    let amount = baseAmount;
    if (state.playerStatuses.burn > 0 && port.chance(state.talentEffects.forgeBurningBonusChance, state)) amount += 1;
    if (port.chance(state.talentEffects.forgeBonusChance, state)) amount += 1;
    if (
      state.playerHealth < state.playerMaxHealth / HALF_DIVISOR &&
      port.chance(state.talentEffects.forgeLowHealthBonusChance, state)
    )
      amount += 1;
    if (amount <= 0) return state;
    let nextState = addPlayerStatus(state, "forge", amount);
    if (!state.uniqueGear.everkeenReady && nextState.uniqueGear.everkeenReady && combatTexts) {
      port.forgeReady(combatTexts);
    }
    if (state.gearEffects.blockOnForgeGain > 0)
      nextState = applyBlockReward(nextState, state.gearEffects.blockOnForgeGain, combatTexts ?? []);
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "player",
        kind: "status",
        stat: "forge",
        amount,
      });
    }
    return nextState;
  }

  function applyBlockGainRewards(state: BattleState, gained: number, combatTexts: CombatTextEvent[]): BattleState {
    let nextState = state;
    if (gained <= 0) return nextState;
    if (port.chance(nextState.talentEffects.drawHolyOnBlockChance, nextState)) {
      nextState = port.drawHoly(nextState, combatTexts);
    }
    return nextState;
  }

  function applyCleanseHeals(state: BattleState, combatTexts?: CombatTextEvent[], removedStatuses = 1): BattleState {
    let nextState = state;
    for (let index = 0; index < removedStatuses; index++) {
      nextState = applyHealingWithCombatText(
        nextState,
        nextState.trinketEffects.sinEaterHealOnHarmfulStatusRemove,
        combatTexts,
      );
      nextState = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnStatusCleanse, combatTexts);
      if (nextState.gearEffects.blockOnCleanse > 0) {
        nextState = applyBlockReward(nextState, nextState.gearEffects.blockOnCleanse, combatTexts ?? []);
      }
      if (nextState.gearEffects.manaOnCleanse > 0) {
        nextState = gainManaWithCombatText(nextState, nextState.gearEffects.manaOnCleanse, combatTexts ?? []);
      }
      if (nextState.talentEffects.nextHolyFreeOnCleanse) nextState = setFlag(nextState, "nextHolyCardFree", true);
    }
    return nextState;
  }

  function removeHarmfulPlayerStatuses(state: BattleState, amount: number, combatTexts?: CombatTextEvent[]) {
    const limit = Number.isFinite(amount) ? amount : harmfulPlayerStatusIds.length;
    let nextState = state;
    let removed = 0;
    for (const statusId of harmfulPlayerStatusIds) {
      if (removed >= limit) break;
      if (nextState.playerStatuses[statusId] <= 0) continue;
      nextState = setPlayerStatus(nextState, statusId, 0);
      if (combatTexts) {
        mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: statusId, signal: "cleanse", text: "" });
      }
      removed++;
    }
    // Clear all selected statuses before healing can trigger further cleansing.
    return applyCleanseHeals(nextState, combatTexts, removed);
  }

  function applyArmorStatusEffect(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
    if (amount <= 0) return state;
    const armorBefore = state.playerStatuses.armor;
    if (state.gearEffects.flatArmorGained > 0 && !state.flags.layeredArmorUsedThisTurn) {
      amount += state.gearEffects.flatArmorGained;
      state = setFlag(state, "layeredArmorUsedThisTurn", true);
    }
    if (state.playerHealth < state.playerMaxHealth / HALF_DIVISOR)
      amount = applyPercentBonus(amount, state.talentEffects.armorLowHealthBonusPercent);
    if (port.chance(state.talentEffects.armorDoubleChance, state)) amount *= 2;
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "armor", amount });
    const nextState = addPlayerStatus(state, "armor", amount);
    const armorGained = nextState.playerStatuses.armor - armorBefore;
    if (armorGained <= 0) return nextState;
    const rewardedState = port.chance(nextState.talentEffects.armorCleanseChance, nextState)
      ? removeHarmfulPlayerStatuses(nextState, 1, combatTexts)
      : nextState;
    return port.chance(nextState.talentEffects.goldOnArmorGainChance, rewardedState)
      ? addGoldWithCombatText(rewardedState, armorGained, combatTexts)
      : rewardedState;
  }
  return {
    resolveHealingWithFeedback,
    applyHealingWithCombatText,
    applyRestorativeCleanse,
    applyHealOnManaGain,
    gainManaWithCombatText,
    addPlayerStatusWithCombatText,
    addGoldWithCombatText,
    applyBlockReward,
    addForgeToPlayer,
    applyCleanseHeals,
    removeHarmfulPlayerStatuses,
    applyArmorStatusEffect,
  };
}
