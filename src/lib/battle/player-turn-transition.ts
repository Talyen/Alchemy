import { expireCcReactions } from "./elemental-reaction-state";
import { resetTurnFlags } from "./combat-flags";
import { mergeCombatText } from "./combat-text-events";
import { resolveSecondaryAction } from "./action-context";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { hasEncounterBenefit, hasEnemyTrait } from "./encounter-trait-state";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import type { BattleCard } from "@/lib/game-data";
import { processArcheryEchoes } from "./unique-card-effects";
import { CARDS_PER_TURN } from "../game-constants";
import { addPlayerStatusWithCombatText, applyHealingWithCombatText, gainManaWithCombatText } from "./player-rewards";
import { halveRounded } from "./amount-helpers";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { applyBlockDepletionRewards, applyCleanseHeals, addForgeToPlayer } from "./status-player";
import { drawCards, applyDrawResult, drawFromState } from "./draw";
import { applyEmergencyWish } from "./wish";
import { applyCardEffects } from "./effect-handlers";
import { finalizeCcSkipTurnDecrement, isCcControlled } from "./status-cc";
import { decayHalvedStatus } from "./status-helpers";
import { PER_TURN_UNIQUE_GEAR_RESET } from "./unique-gear-state";
import { getBattleRng } from "@/lib/rng";
import type { BattleState, CcState, CombatTextEvent } from "./types";
import { deathsDoorGraceTurns } from "./health-state";
import { getBattleOutcome } from "./battle-outcome";
import { applyTurnStartPurge } from "./enemy-purge";

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
  if (poison === 0) {
    mergeCombatText(combatTexts, { target: "player", kind: "notice", stat: "poison", signal: "cleanse", text: "" });
  } else {
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "poison", amount: removed, impact: false });
  }
  const reduced = { ...state, playerStatuses: { ...state.playerStatuses, poison } };
  const cleansed = resolvePendingBattleReactions(
    poison === 0 ? applyCleanseHeals(reduced, combatTexts) : reduced,
    combatTexts,
  );
  if (getBattleOutcome(cleansed) !== null) return cleansed;
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
  const kept: BattleState["pendingTurnStartEffects"] = [];
  for (const pulse of state.pendingTurnStartEffects) {
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
  // Commit the remaining schedule before executing pulses, so effects queued
  // by a pulse survive and start on the following turn.
  return resolveSecondaryAction({ ...state, pendingTurnStartEffects: kept }, "delayed-card", (current) => {
    for (const pulse of state.pendingTurnStartEffects) {
      if (getBattleOutcome(current) !== null) break;
      current = applyCardEffects(current, { ...pulseCard, ...pulse.sourceCard, effects: pulse.effects }, combatTexts, {
        manaAtStart: current.mana,
        origin: "triggered-card",
      });
    }
    return current;
  });
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
  const returningUid = state.gearEffects.recoverLastArcheryCard > 0 ? state.uniqueGear.lastArcheryUid : null;
  const returningIndex = returningUid === null ? -1 : state.discard.findIndex((card) => card.uid === returningUid);
  // An empty draw pile can already have refilled from discard before this turn.
  // Recover that same card before ordinary draws so its one-play discount survives.
  const deckIndex =
    returningUid !== null && returningIndex < 0 ? state.deck.findIndex((card) => card.uid === returningUid) : -1;
  const recovered = returningIndex >= 0 ? state.discard[returningIndex] : state.deck[deckIndex];
  const discard = returningIndex >= 0 ? state.discard.filter((_, i) => i !== returningIndex) : state.discard;
  // Receive the recovered card behind older reservations, before new draws.
  const returningFlightUid = recovered ? state.nextCardUid : null;
  const pendingHandCards = recovered
    ? [...state.pendingHandCards, { ...recovered, uid: state.nextCardUid }]
    : state.pendingHandCards;
  const nextDraw = drawCards(
    deckIndex >= 0 ? state.deck.filter((_, i) => i !== deckIndex) : state.deck,
    discard,
    state.hand,
    CARDS_PER_TURN,
    state.nextCardUid + Number(!!recovered),
    getBattleRng(state),
    pendingHandCards,
  );
  // Enemy-phase deliveries and overflow queues have not had a playable turn yet.
  const returningFlightUids: number[] = [];
  if (state.uniqueGear.returningFlightUids.length > 0) {
    const eligibleUids = new Set(state.hand.map((card) => card.uid));
    for (const card of state.pendingHandCards) eligibleUids.add(card.uid);
    for (const uid of state.uniqueGear.returningFlightUids) {
      if (eligibleUids.has(uid)) returningFlightUids.push(uid);
    }
  }
  if (returningFlightUid !== null) returningFlightUids.push(returningFlightUid);
  const nextState = resetPlayerTurnState(state, options);
  const hadUnspentMana = (options?.manaAtTurnEnd ?? state.mana) > 0;
  const wellspringBonus =
    hadUnspentMana && state.talentEffects.wellspringKeepMana > 0 ? state.talentEffects.wellspringKeepMana : 0;
  return {
    ...applyDrawResult(nextState, nextDraw),
    uniqueGear: { ...nextState.uniqueGear, returningFlightUids },
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
  if (getBattleOutcome(state) !== null) return state;
  const deathsDoorNeedsRecoveryTurn = state.deathsDoorActive;

  let nextState = state;
  if (deathsDoorNeedsRecoveryTurn && !options?.preserveBlock) {
    nextState = {
      ...state,
      deathsDoorGraceTurnsRemaining: computeDeathsDoorGraceRemaining(state) - 1,
    };
  }

  const beforeTurnReset = nextState;
  nextState = performDrawAndResetPhase(nextState, deathsDoorNeedsRecoveryTurn, options);
  const retainedBlock = nextState.playerStatuses.block > 0;
  const blockDepleted = beforeTurnReset.playerStatuses.block > 0 && !retainedBlock;
  nextState = resolvePendingBattleReactions(applyTurnStartPurge(nextState, combatTexts), combatTexts);
  if (getBattleOutcome(nextState) !== null) return nextState;
  if (retainedBlock && nextState.gearEffects.thornsOnRetainedBlock > 0) {
    nextState = addPlayerStatusWithCombatText(
      nextState,
      "thorns",
      nextState.gearEffects.thornsOnRetainedBlock,
      combatTexts,
    );
  }
  nextState = resolvePendingBattleReactions(
    applyBlockDepletionRewards(beforeTurnReset, nextState, combatTexts, blockDepleted),
    combatTexts,
  );
  if (getBattleOutcome(nextState) !== null) return nextState;
  if (nextState.gearEffects.forgeEveryThreeTurns > 0 && nextState.turn % 3 === 0)
    nextState = addForgeToPlayer(nextState, 1, combatTexts);
  if (getBattleOutcome(nextState) !== null) return nextState;
  if (
    !nextState.wishOptions &&
    nextState.hand.length === 0 &&
    nextState.deck.length === 0 &&
    nextState.discard.length === 0
  )
    nextState = resolvePendingBattleReactions(applyEmergencyWish(nextState, combatTexts), combatTexts);
  if (getBattleOutcome(nextState) !== null) return nextState;
  const recovered =
    state.flags.darkRecoveryMana > 0
      ? gainManaWithCombatText(nextState, state.flags.darkRecoveryMana, combatTexts, {
          allowOverflow: true,
          skipFightPacing: true,
        })
      : nextState;
  const drawnState = processArcheryEchoes(
    processPendingTurnStartEffects(applyPlagueDoctorMask(recovered, combatTexts), combatTexts),
    combatTexts,
  );
  const healedState =
    getBattleOutcome(drawnState) === null && drawnState.gearEffects.healthPerTurn > 0
      ? applyHealingWithCombatText(drawnState, drawnState.gearEffects.healthPerTurn, combatTexts)
      : drawnState;
  return resolvePendingBattleReactions(healedState, combatTexts);
}

export function reduceSkipTurns(state: BattleState, combatTexts: CombatTextEvent[] = []): BattleState {
  const prevCc = state.enemyCC;
  const decrementedCc = decrementCcSkipTurns(prevCc);
  const nextState = expireCcReactions({
    ...state,
    enemyCC: finalizeCcSkipTurnDecrement(prevCc, decrementedCc),
  });
  return prevCc.freezeSkipTurns > 0 &&
    nextState.enemyCC.freezeSkipTurns === 0 &&
    getBattleOutcome(nextState) === null &&
    state.talentEffects.drawOnThaw > 0
    ? applyDrawResult(nextState, drawFromState(nextState, state.talentEffects.drawOnThaw), combatTexts)
    : nextState;
}

export function resolveDeathsDoorGraceExpiry(state: BattleState, combatTexts: CombatTextEvent[] = []): BattleState {
  if (!state.deathsDoorActive) return state;
  const remaining = computeDeathsDoorGraceRemaining(state);
  if (remaining <= 0) {
    const survived = {
      ...state,
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
    };
    return survived.playerHealth > 0 && survived.gearEffects.healOnDeathsDoorSurvival > 0
      ? applyHealingWithCombatText(survived, survived.gearEffects.healOnDeathsDoorSurvival, combatTexts)
      : survived;
  }
  return state;
}
