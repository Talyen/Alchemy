import { resolvePendingCinderSkinReaction } from "./enemy-attack-damage";
import { hasEncounterBenefit, hasEnemyTrait } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import type { BattleCard } from "@/lib/game-data";
import { processArcheryEchoes } from "./unique-card-effects";
import { CARDS_PER_TURN, MAX_HAND_SIZE } from "../game-constants";
import { addPlayerStatusWithCombatText, applyHealingWithCombatText, gainManaWithCombatText } from "./combat-text";
import { halveRounded } from "./amount-helpers";
import { dealPlayerTypedHit } from "./player-typed-hit";
import { applyCleanseHeals } from "./status-player";
import { drawCards, applyDrawResult, drawFromState } from "./draw";
import { applyCardEffects } from "./effect-handlers";
import { finalizeCcSkipTurnDecrement, isPlayerCcControlled } from "./status-cc";
import { decayHalvedStatus } from "./status-helpers";
import { getBattleRng } from "@/lib/rng";
import {
  isPlayerDefeated,
  deathsDoorGraceTurns,
  type BattleState,
  type CombatTextEvent,
  withPreservedFlags,
} from "./types";

function applyPlagueDoctorMask(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.playerHealth <= 0 || state.enemyHealth <= 0) return state;
  const removed = Math.min(state.playerStatuses.poison, state.trinketEffects.plagueDoctorPoisonCleanse);
  if (removed <= 0) return state;
  const cleansed = applyCleanseHeals(
    { ...state, playerStatuses: { ...state.playerStatuses, poison: state.playerStatuses.poison - removed } },
    combatTexts,
  );
  return resolvePendingCinderSkinReaction(
    dealPlayerTypedHit(cleansed, "poison", halveRounded(removed), combatTexts),
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
  return withPreservedFlags({ ...state, pendingTurnStartEffects: kept }, (nextState) =>
    due.reduce(
      (current, pulse) =>
        current.enemyHealth <= 0 || isPlayerDefeated(current)
          ? current
          : applyCardEffects(current, { ...pulseCard, effects: pulse.effects }, combatTexts, {
              manaAtStart: current.mana,
              enemyFreezeSkipTurnsAtStart: current.enemyCC.freezeSkipTurns,
              cardHealing: true,
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
      redHarvestUsed: false,
      redHarvestUid: null,
      huntsmasterUsed: false,
      wrenflightActive: false,
      finalSparkUsed: false,
      freeBurnUsed: false,
      freeFreezeUsed: false,
      freeHolyUsed: false,
      lastArcheryUid: null,
      returningFlightUid: null,
      spentForge: 0,
    },
    flags: {
      ...state.flags,
      previousCardWasArchery: false,
      previousCardWasNature: false,
      darkRecoveryMana: 0,
      pendingWishMana: 0,
      encounterPhysicalUsed: false,
      encounterHolyUsed: false,
      encounterNatureUsed: false,
      encounterWishUsed: false,
      encounterArcheryUsed: false,
      resonantChimeUsedThisTurn: false,
      runicQuillUsedThisTurn: false,
      consumeDrawUsedThisTurn: false,
      emberforgedUsedThisTurn: false,
      cinderSkinUsedThisTurn: false,
      holyRetributionUsedThisTurn: false,
      nextCardCostReduction: 0,
    },
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
  if (!isPlayerCcControlled(prevCc)) return state;
  const decrementedCc = {
    ...prevCc,
    stunSkipTurns: Math.max(0, prevCc.stunSkipTurns - 1),
    freezeSkipTurns: Math.max(0, prevCc.freezeSkipTurns - 1),
  };
  return {
    ...state,
    playerCC: finalizeCcSkipTurnDecrement(prevCc, decrementedCc),
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

  if (state.gearEffects.recoverSpentForge > 0 && state.uniqueGear.spentForge > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "forge", state.uniqueGear.spentForge, combatTexts, {
      skipFightPacing: true,
    });
  }
  const reset = performDrawAndResetPhase(nextState, deathsDoorNeedsRecoveryTurn, options);
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
    drawnState.gearEffects.healthPerTurn > 0
      ? applyHealingWithCombatText(drawnState, drawnState.gearEffects.healthPerTurn, combatTexts)
      : drawnState;
  return resolvePendingCinderSkinReaction(healedState, combatTexts);
}

export function reduceSkipTurns(state: BattleState): BattleState {
  const prevCc = state.enemyCC;
  const decrementedCc = {
    ...prevCc,
    stunSkipTurns: Math.max(0, prevCc.stunSkipTurns - 1),
    freezeSkipTurns: Math.max(0, prevCc.freezeSkipTurns - 1),
  };
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
