import { harmfulPlayerStatusIds, type BattleCardEffect, type PlayerStatusId } from "@/lib/game-data";
import { HALF_DIVISOR, PERCENT_DENOMINATOR, SECOND_WIND_HEALTH_THRESHOLD_PERCENT } from "../game-constants";
import { applyPercentBonus } from "./amount-helpers";
import { emitStatusText, emitHealText, emitNoticeText } from "./combat-text-events";
import { blockAmountWithForge, setPlayerStatus, addPlayerStatus } from "./status-state";
import { effectivePlayerHealingAmount, resolvePlayerHealing } from "./health-state";
import { readCombatFlag, resolveSecondaryAction, writeCombatFlag as setFlag } from "./action-context";
import { gainMana, scaleGoldReward } from "./resource-state";
import { paceCombatMagnitude } from "./fight-pacing";
import { isPlayerDefeated } from "./battle-outcome";
import type { BattleState, CombatTextEvent } from "./types";

interface PlayerResourceResolutionPort {
  chance: (chance: number, state: BattleState) => boolean;
  afterHealing: (state: BattleState, restored: number, texts?: CombatTextEvent[]) => BattleState;
  drawHoly: (state: BattleState, texts: CombatTextEvent[]) => BattleState;
  forgeReady: (texts: CombatTextEvent[]) => void;
}

interface FeedbackOptions {
  feedback?: CombatTextEvent["feedback"];
}

const feedbackIntent = (options?: FeedbackOptions) => (options?.feedback ? { feedback: options.feedback } : {});

/** One reward interpreter for live combat and nonrandom inspection; ports own external reactions. */
export function createPlayerResourceResolver(port: PlayerResourceResolutionPort) {
  function emitGainedStatusText(
    before: Pick<BattleState, "playerStatuses">,
    after: Pick<BattleState, "playerStatuses">,
    stat: "block" | "thorns",
    combatTexts: CombatTextEvent[],
    options?: FeedbackOptions,
  ) {
    const gained = after.playerStatuses[stat] - before.playerStatuses[stat];
    if (gained <= 0) return;
    emitStatusText(combatTexts, "player", stat, gained, { ...feedbackIntent(options) });
  }

  function resolveHealingWithFeedback(
    state: BattleState,
    amount: number,
    combatTexts?: CombatTextEvent[],
    allowOverhealBlock = false,
    options?: FeedbackOptions,
  ) {
    const healing = resolvePlayerHealing(state, amount, allowOverhealBlock);
    if (combatTexts) {
      if (healing.effective > 0) {
        emitHealText(combatTexts, "player", "health", healing.effective, { ...feedbackIntent(options) });
      }
      emitGainedStatusText(state, healing.state, "block", combatTexts, options);
      emitGainedStatusText(state, healing.state, "thorns", combatTexts);
    }
    return healing;
  }

  function applyHealingWithCombatText(
    state: BattleState,
    amount: number,
    combatTexts?: CombatTextEvent[],
    options?: FeedbackOptions & { skipFightPacing?: boolean; allowOverhealBlock?: boolean },
  ): BattleState {
    if (amount <= 0) return state;
    const healAmount = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "player");
    const healing = resolveHealingWithFeedback(state, healAmount, combatTexts, options?.allowOverhealBlock, options);
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

  function applyManaGainRewards(state: BattleState, gainAmount: number, combatTexts: CombatTextEvent[]): BattleState {
    if (gainAmount <= 0) return state;
    const blocked =
      state.playerStatuses.block === 0 && state.gearEffects.blockOnManaRestoreWithoutBlock > 0
        ? applyBlockReward(state, state.gearEffects.blockOnManaRestoreWithoutBlock, combatTexts)
        : state;
    if (blocked.talentEffects.healthPerMana > 0) {
      return applyHealingWithCombatText(blocked, gainAmount * blocked.talentEffects.healthPerMana, combatTexts);
    }
    return blocked;
  }

  function gainManaWithCombatText(
    state: BattleState,
    amount: number,
    combatTexts?: CombatTextEvent[],
    options?: FeedbackOptions & { skipFightPacing?: boolean; allowOverflow?: boolean },
  ): BattleState {
    if (amount <= 0) return state;
    const granted = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "player");
    if (options?.feedback === "primary") state.observer?.descriptionMagnitude?.("amount", granted);
    const nextState = gainMana(state, granted, options?.allowOverflow);
    const gained = nextState.mana - state.mana;
    if (gained > 0 && combatTexts) {
      emitStatusText(combatTexts, "player", "mana", gained, { ...feedbackIntent(options) });
    }
    return applyManaGainRewards(nextState, gained, combatTexts ?? []);
  }

  function addPlayerStatusWithCombatText(
    state: BattleState,
    stat: PlayerStatusId,
    amount: number,
    combatTexts?: CombatTextEvent[],
    options?: FeedbackOptions & { skipFightPacing?: boolean },
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
      emitStatusText(combatTexts, "player", stat, delta, { ...feedbackIntent(options) });
    }
    if (stat === "block" && combatTexts) {
      emitGainedStatusText(previousState, nextState, "thorns", combatTexts);
    }
    return stat === "block" ? applyBlockGainRewards(nextState, delta, combatTexts ?? []) : nextState;
  }

  function addGoldWithCombatText(
    state: BattleState,
    amount: number,
    combatTexts?: CombatTextEvent[],
    options?: FeedbackOptions,
  ): BattleState {
    if (amount <= 0) return state;

    const gold = Math.min(Number.MAX_SAFE_INTEGER, state.gold + scaleGoldReward(amount, state.gearEffects));
    const scaledGold = gold - state.gold;
    if (scaledGold <= 0) return state;
    let nextState = { ...state, gold };
    if (combatTexts) {
      emitStatusText(combatTexts, "player", "gold", scaledGold, { ...feedbackIntent(options) });
    }
    if (nextState.gearEffects.healOnCombatGoldGain > 0) {
      nextState = applyHealingWithCombatText(nextState, nextState.gearEffects.healOnCombatGoldGain, combatTexts ?? []);
    }
    return state.gearEffects.goldGrantsForgeAndHoly > 0 ? addForgeToPlayer(nextState, 1, combatTexts) : nextState;
  }

  function applyBlockReward(
    state: BattleState,
    amount: number,
    combatTexts: CombatTextEvent[],
    options?: FeedbackOptions & { skipFightPacing?: boolean },
  ): BattleState {
    return addPlayerStatusWithCombatText(state, "block", amount, combatTexts, options);
  }

  function addForgeToPlayer(
    state: BattleState,
    baseAmount: number,
    combatTexts?: CombatTextEvent[],
    options?: FeedbackOptions,
  ): BattleState {
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
      emitStatusText(combatTexts, "player", "forge", amount, { ...feedbackIntent(options) });
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

  function removeHarmfulPlayerStatuses(
    state: BattleState,
    amount: number,
    combatTexts?: CombatTextEvent[],
    options?: FeedbackOptions,
  ) {
    const limit = Number.isFinite(amount) ? amount : harmfulPlayerStatusIds.length;
    let nextState = state;
    let removed = 0;
    for (const statusId of harmfulPlayerStatusIds) {
      if (removed >= limit) break;
      if (nextState.playerStatuses[statusId] <= 0) continue;
      nextState = setPlayerStatus(nextState, statusId, 0);
      if (combatTexts) {
        emitNoticeText(combatTexts, "player", statusId, "", { signal: "cleanse", ...feedbackIntent(options) });
      }
      removed++;
    }
    // Clear all selected statuses before healing can trigger further cleansing.
    return applyCleanseHeals(nextState, combatTexts, removed);
  }

  function applyArmorStatusEffect(
    state: BattleState,
    amount: number,
    combatTexts: CombatTextEvent[],
    options?: FeedbackOptions,
  ): BattleState {
    if (amount <= 0) return state;
    const armorBefore = state.playerStatuses.armor;
    if (state.gearEffects.flatArmorGained > 0 && !state.flags.layeredArmorUsedThisTurn) {
      amount += state.gearEffects.flatArmorGained;
      state = setFlag(state, "layeredArmorUsedThisTurn", true);
    }
    if (state.playerHealth < state.playerMaxHealth / HALF_DIVISOR)
      amount = applyPercentBonus(amount, state.talentEffects.armorLowHealthBonusPercent);
    if (port.chance(state.talentEffects.armorDoubleChance, state)) amount *= 2;
    emitStatusText(combatTexts, "player", "armor", amount, { ...feedbackIntent(options) });
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

  function applyCardHealing(
    state: BattleState,
    amount: number,
    combatTexts: CombatTextEvent[],
    options?: FeedbackOptions & { skipFightPacing?: boolean; allowOverhealBlock?: boolean },
  ): BattleState {
    const paced = options?.skipFightPacing ? amount : paceCombatMagnitude(state, amount, "player");
    const overheals =
      effectivePlayerHealingAmount(state, paced) > Math.max(0, state.playerMaxHealth - state.playerHealth);
    const healed = applyHealingWithCombatText(state, paced, combatTexts, {
      skipFightPacing: true,
      allowOverhealBlock: options?.allowOverhealBlock ?? true,
      ...feedbackIntent(options),
    });
    return overheals && state.talentEffects.cleanseOnCardOverheal
      ? removeHarmfulPlayerStatuses(healed, 1, combatTexts)
      : healed;
  }

  function applyBlockDepletionRewards(
    previousState: BattleState,
    nextState: BattleState,
    combatTexts: CombatTextEvent[],
    depleted = previousState.playerStatuses.block > 0 && nextState.playerStatuses.block <= 0,
  ): BattleState {
    if (!depleted || isPlayerDefeated(nextState)) return nextState;
    const healing = previousState.talentEffects.blockDepletedHeal + previousState.gearEffects.blockDepletedHeal;
    const rewarded = healing > 0 ? applyHealingWithCombatText(nextState, healing, combatTexts) : nextState;

    return previousState.gearEffects.thornsOnBlockDepleted > 0
      ? addPlayerStatusWithCombatText(rewarded, "thorns", previousState.gearEffects.thornsOnBlockDepleted, combatTexts)
      : rewarded;
  }

  function crossedBelow(prevHealth: number, nextHealth: number, thresholdHp: number): boolean {
    return prevHealth >= thresholdHp && nextHealth < thresholdHp;
  }

  function applyHealthThresholdCleanse(
    previousHealth: number,
    state: BattleState,
    combatTexts?: CombatTextEvent[],
    healthAfterDamage = state.playerHealth,
  ): BattleState {
    const threshold = (state.playerMaxHealth * state.talentEffects.cleanseBelowHealthPercent) / PERCENT_DENOMINATOR;
    return threshold > 0 && healthAfterDamage > 0 && crossedBelow(previousHealth, healthAfterDamage, threshold)
      ? removeHarmfulPlayerStatuses(state, Infinity, combatTexts)
      : state;
  }

  function checkHealthThresholds(
    prevHealth: number,
    nextHealth: number,
    state: BattleState,
    combatTexts: CombatTextEvent[],
  ): BattleState {
    if (nextHealth <= 0) return state;
    let nextState = applyHealthThresholdCleanse(prevHealth, state, combatTexts, nextHealth);
    const maxHealth = state.playerMaxHealth;

    if (
      state.gearEffects.healOnFirstQuarterHealth > 0 &&
      !state.flags.gearSecondWindUsed &&
      crossedBelow(prevHealth, nextHealth, (maxHealth * SECOND_WIND_HEALTH_THRESHOLD_PERCENT) / PERCENT_DENOMINATOR)
    ) {
      nextState = applyHealingWithCombatText(
        setFlag(nextState, "gearSecondWindUsed", true),
        state.gearEffects.healOnFirstQuarterHealth,
        combatTexts,
      );
    }

    const once = state.talentEffects.healthThresholdBlockOnce;
    if (once && !readCombatFlag(nextState, "desperateGuardUsed")) {
      const thresholdHp = (maxHealth * once.threshold) / PERCENT_DENOMINATOR;
      if (crossedBelow(prevHealth, nextHealth, thresholdHp)) {
        nextState = applyBlockReward(nextState, once.amount, combatTexts);
        nextState = { ...nextState, flags: { ...nextState.flags, desperateGuardUsed: true } };
      }
    }
    for (const config of state.talentEffects.healthThresholdArmor) {
      const thresholdHp = (maxHealth * config.threshold) / PERCENT_DENOMINATOR;
      if (!crossedBelow(prevHealth, nextHealth, thresholdHp)) continue;
      nextState = applyArmorReward(nextState, config.amount, combatTexts);
    }
    return nextState;
  }

  function applyPlayerStatusEffect(
    state: BattleState,
    effect: Extract<BattleCardEffect, { kind: "player-status" }>,
    combatTexts: CombatTextEvent[],
    options?: FeedbackOptions,
  ) {
    if (effect.status === "armor") return applyArmorStatusEffect(state, effect.amount, combatTexts, options);
    if (effect.status === "forge") {
      return addForgeToPlayer(state, effect.amount, combatTexts, options);
    }
    if (effect.status === "block") {
      return applyBlockReward(state, effect.amount, combatTexts, options);
    }
    return addPlayerStatusWithCombatText(state, effect.status, effect.amount, combatTexts, {
      skipFightPacing: true,
      ...feedbackIntent(options),
    });
  }

  function applyArmorReward(state: BattleState, amount: number, combatTexts: CombatTextEvent[]): BattleState {
    if (amount <= 0) return state;
    return resolveSecondaryAction(state, "reward", (current) => applyArmorStatusEffect(current, amount, combatTexts));
  }

  return {
    applyArmorReward,
    applyCardHealing,
    applyBlockDepletionRewards,
    applyHealthThresholdCleanse,
    checkHealthThresholds,
    applyPlayerStatusEffect,
    resolveHealingWithFeedback,
    applyHealingWithCombatText,
    applyRestorativeCleanse,
    applyManaGainRewards,
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
