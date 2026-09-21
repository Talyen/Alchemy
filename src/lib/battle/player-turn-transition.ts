import { resetTurnFlags } from "./combat-flags";
import { resolveSecondaryAction } from "./action-context";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { hasEncounterBenefit, hasEnemyTrait } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import type { BattleCard } from "@/lib/game-data";
import { processArcheryEchoes } from "./unique-card-effects";
import { CARDS_PER_TURN, MAX_HAND_SIZE } from "../game-constants";
import { applyHealingWithCombatText, gainManaWithCombatText } from "./combat-text";
import { halveRounded } from "./amount-helpers";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { applyCleanseHeals, restoreSpentPlayerForge } from "./status-player";
import { drawCards, applyDrawResult, drawFromState } from "./draw";
import { applyEmergencyWish } from "./wish";
import { applyCardEffects } from "./effect-handlers";
import { finalizeCcSkipTurnDecrement, isCcControlled } from "./status-cc";
import { decayHalvedStatus } from "./status-helpers";
import { PER_TURN_UNIQUE_GEAR_RESET } from "./unique-gear-state";
import { getBattleRng } from "@/lib/rng";
import { isPlayerDefeated, deathsDoorGraceTurns, type BattleState, type CcState, type CombatTextEvent } from "./types";

function decrementCcSkipTurns(cc: CcState): CcState {
  return {
    ...cc,
    stunSkipTurns: Math.max(0, cc.stunSkipTurns - 1),
    freezeSkipTurns: Math.max(0, cc.freezeSkipTurns - 1),
  };
}

function applyPlagueDoctorMask(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.playerHealth <= 0 || state.enemyHealth <= 0) return state;
  const removed = Math.min(state.playerStatuses.poison, state.trinketEffects.plagueDoctorPoisonCleanse);
  if (removed <= 0) return state;
  const poison = state.playerStatuses.poison - removed;
  const reduced = { ...state, playerStatuses: { ...state.playerStatuses, poison } };
  const cleansed = poison === 0 ? applyCleanseHeals(reduced, combatTexts) : reduced;
  return resolvePendingBattleReactions(
    resolveSecondaryAction(cleansed, "delayed-card", (current) =>
      resolveFollowUpHit(
        current,
        { source: "player-follow-up", damageType: "poison", amount: halveRounded(removed) },
        combatTexts,
      ),
    ),
    combatTexts,
  );
}

function computeDeathsDoorGraceRemaining(state: BattleState): number {
  if (state.deathsDoorGraceTurnsRemaining !== null) return state.deathsDoorGraceTurnsRemaining;
  if (state.deathsDoorTriggeredTurn !== null) {
    const graceTurns = deathsDoorGraceTurns(state.talentEffects.deathsDoorExtension);
    return graceTurns - (state.turn - state.deathsDoorTriggeredTurn);
  }
  return deathsDoorGraceTurns(state.talentEffects.deathsDoorExtension);
}

function processPendingTurnStartEffects(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.pendingTurnStartEffects.length === 0) return state;
  const due: BattleState["pendingTurnStartEffects"] = [];
  const kept: BattleState["pendingTurnStartEffects"] = [];
  for (const pulse of state.pendingTurnStartEffects) {
    due.push(pulse);
    if (pulse.remainingTurns > 1) kept.push({ ...pulse, remainingTurns: pulse.remainingTurns - 1 });
  }
  const pulseCard: BattleCard = {
    id: "pending-turn-start",
    title: "",
    descriptionLines: [],
    art: "",
    cost: 0,
    effects: [],
  };
  return resolveSecondaryAction({ ...state, pendingTurnStartEffects: kept }, "delayed-card", (nextState) =>
    due.reduce(
      (current, pulse) =>
        current.enemyHealth <= 0 || isPlayerDefeated(current)
          ? current
          : applyCardEffects(current, { ...pulseCard, ...pulse.sourceCard, effects: pulse.effects }, combatTexts, {
              manaAtStart: current.mana,
              enemyFreezeSkipTurnsAtStart: current.enemyCC.freezeSkipTurns,
              origin: "triggered-card",
            }),
      nextState,
    ),
  );
}

function resetPlayerTurnState(
  state: BattleState,
  options?: { preserveBlock?: boolean; manaAtTurnEnd?: number },
): BattleState {
  return {
    ...state,
    turn: state.turn + 1,
    playerCC: { ...state.playerCC, cooldown: Math.max(0, state.playerCC.cooldown - 1) },
    enemyCC: { ...state.enemyCC, cooldown: Math.max(0, state.enemyCC.cooldown - 1) },
    playerStatuses: {
      ...state.playerStatuses,
      thorns: hasEncounterBenefit(state, "bramblecoat")
        ? Math.max(state.playerStatuses.thorns, LABYRINTH_MODIFIER_CONFIG.playerThornsMinimum)
        : state.playerStatuses.thorns,
      block:
        options?.preserveBlock ||
        hasEncounterBenefit(state, "unbroken") ||
        state.gearEffects.dodgeSpendsPreservedBlock > 0
          ? state.playerStatuses.block
          : decayHalvedStatus(state.playerStatuses.block),
    },
    cardsPlayedThisTurn: 0,
    uniqueGear: {
      ...state.uniqueGear,
      ...PER_TURN_UNIQUE_GEAR_RESET,
    },
    flags: resetTurnFlags(state.flags),
  };
}

export function resetEnemyTurnState(state: BattleState): BattleState {
  const thornsMinimum = hasEnemyTrait(state, "briar-crown")
    ? LABYRINTH_MODIFIER_CONFIG.bossThornsMinimum
    : hasEnemyTrait(state, "thornhide")
      ? LABYRINTH_MODIFIER_CONFIG.enemyThornsMinimum
      : 0;
  return {
    ...state,
    enemyStatuses: { ...state.enemyStatuses, thorns: Math.max(state.enemyStatuses.thorns, thornsMinimum) },
    enemyMitigation: {
      ...state.enemyMitigation,
      block: hasEnemyTrait(state, "entrenched")
        ? state.enemyMitigation.block
        : decayHalvedStatus(state.enemyMitigation.block),
    },
  };
}

export function reducePlayerSkipTurns(state: BattleState): BattleState {
  const prevCc = state.playerCC;
  if (!isCcControlled(prevCc)) return state;
  return {
    ...state,
    playerCC: finalizeCcSkipTurnDecrement(prevCc, decrementCcSkipTurns(prevCc)),
  };
}

function performDrawAndResetPhase(
  state: BattleState,
  deathsDoorNeedsRecoveryTurn: boolean,
  options?: { preserveBlock?: boolean; manaAtTurnEnd?: number },
): BattleState {
  const returningIndex =
    state.gearEffects.recoverLastArcheryCard > 0 && state.uniqueGear.lastArcheryUid !== null
      ? state.discard.findIndex((card) => card.uid === state.uniqueGear.lastArcheryUid)
      : -1;
  const recovered = returningIndex >= 0 ? state.discard[returningIndex] : undefined;
  const discard = recovered ? state.discard.filter((_, i) => i !== returningIndex) : state.discard;
  const nextDraw = drawCards(state.deck, discard, state.hand, CARDS_PER_TURN, state.nextCardUid, getBattleRng(state));
  let returningFlightUid: number | null = null;
  if (recovered && nextDraw.hand.length < MAX_HAND_SIZE) {
    returningFlightUid = nextDraw.nextCardUid;
    nextDraw.hand.push({ ...recovered, uid: returningFlightUid });
    nextDraw.nextCardUid += 1;
  } else if (recovered) {
    nextDraw.discard.push(recovered);
  }
  const nextState = resetPlayerTurnState(state, options);
  const hadUnspentMana = (options?.manaAtTurnEnd ?? state.mana) > 0;
  const wellspringBonus =
    hadUnspentMana && state.talentEffects.wellspringKeepMana > 0 ? state.talentEffects.wellspringKeepMana : 0;
  return {
    ...applyDrawResult(nextState, nextDraw),
    uniqueGear: { ...nextState.uniqueGear, returningFlightUid },
    turnPhase: "player",
    mana:
      nextState.maxMana +
      wellspringBonus +
      (hasEncounterBenefit(state, "wellspring") ? LABYRINTH_MODIFIER_CONFIG.manaBonus : 0),
    playerCC: {
      ...nextState.playerCC,
      stunSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : nextState.playerCC.stunSkipTurns,
      freezeSkipTurns: deathsDoorNeedsRecoveryTurn ? 0 : nextState.playerCC.freezeSkipTurns,
    },
  };
}

export function advanceToPlayerTurn(
  state: BattleState,
  combatTexts: CombatTextEvent[] = [],
  options?: { preserveBlock?: boolean; manaAtTurnEnd?: number },
) {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;
  const deathsDoorNeedsRecoveryTurn = state.deathsDoorActive;

  let nextState = state;
  if (deathsDoorNeedsRecoveryTurn && !options?.preserveBlock) {
    nextState = {
      ...state,
      deathsDoorGraceTurnsRemaining: computeDeathsDoorGraceRemaining(state) - 1,
    };
  }

  nextState = performDrawAndResetPhase(nextState, deathsDoorNeedsRecoveryTurn, options);
  nextState = resolvePendingBattleReactions(restoreSpentPlayerForge(nextState, combatTexts), combatTexts);
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) return nextState;
  if (
    !nextState.wishOptions &&
    nextState.hand.length === 0 &&
    nextState.deck.length === 0 &&
    nextState.discard.length === 0
  )
    nextState = applyEmergencyWish(nextState, combatTexts);
  const reset = nextState;
  const wished =
    state.flags.pendingWishMana > 0
      ? gainManaWithCombatText(reset, state.flags.pendingWishMana, combatTexts, {
          allowOverflow: true,
          skipFightPacing: true,
        })
      : reset;
  const recovered =
    state.flags.darkRecoveryMana > 0
      ? gainManaWithCombatText(wished, state.flags.darkRecoveryMana, combatTexts, {
          allowOverflow: true,
          skipFightPacing: true,
        })
      : wished;
  const drawnState = processArcheryEchoes(
    processPendingTurnStartEffects(applyPlagueDoctorMask(recovered, combatTexts), combatTexts),
    combatTexts,
  );
  const healedState =
    drawnState.enemyHealth > 0 && !isPlayerDefeated(drawnState) && drawnState.gearEffects.healthPerTurn > 0
      ? applyHealingWithCombatText(drawnState, drawnState.gearEffects.healthPerTurn, combatTexts)
      : drawnState;
  return resolvePendingBattleReactions(healedState, combatTexts);
}

export function reduceSkipTurns(state: BattleState): BattleState {
  const prevCc = state.enemyCC;
  const decrementedCc = decrementCcSkipTurns(prevCc);
  const nextState = {
    ...state,
    enemyCC: finalizeCcSkipTurnDecrement(prevCc, decrementedCc),
  };
  return prevCc.freezeSkipTurns > 0 &&
    nextState.enemyCC.freezeSkipTurns === 0 &&
    nextState.enemyHealth > 0 &&
    !isPlayerDefeated(nextState) &&
    state.talentEffects.drawOnThaw > 0
    ? applyDrawResult(nextState, drawFromState(nextState, state.talentEffects.drawOnThaw))
    : nextState;
}

export function resolveDeathsDoorGraceExpiry(state: BattleState): BattleState {
  if (!state.deathsDoorActive) return state;
  const remaining = computeDeathsDoorGraceRemaining(state);
  if (remaining <= 0) {
    return {
      ...state,
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
    };
  }
  return state;
}
