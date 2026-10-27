import { mergeCombatText } from "./combat-text-events";
import type { BattleState, CombatTextEvent } from "./types";
import { isStunFreezeBuildupBlocked } from "./crowd-control-policy";
import type { EnemyStatusId, PlayerStatusId } from "@/lib/game-data";
import { HALF_DIVISOR, LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { scalePercent, halveRounded } from "./amount-helpers";
import { hasEncounterBenefit, hasEnemyTrait } from "./encounter-trait-state";
import { reduceEnemyArmor } from "./enemy-mitigation-state";

export function blockAmountWithForge(state: BattleState, amount: number): number {
  if (amount <= 0) return amount;
  const forgeBonus = scalePercent(state.playerStatuses.forge, state.talentEffects.forgeBlockPercent);
  return amount + forgeBonus;
}

function playerStatusDelta(state: BattleState, status: PlayerStatusId, delta: number): number {
  if (status === "stun" && delta > 0) {
    return Math.max(0, Math.round(delta));
  }
  if (status !== "block" || delta <= 0) return delta;
  return (
    delta +
    state.gearEffects.flatBlockGained +
    (state.playerHealth < state.playerMaxHealth / HALF_DIVISOR ? state.gearEffects.blockGainBonusBelowHalfHealth : 0)
  );
}

export function addPlayerStatus(state: BattleState, status: PlayerStatusId, delta: number): BattleState {
  if ((status === "stun" || status === "freeze") && isStunFreezeBuildupBlocked(state.playerCC)) {
    return state;
  }
  const effectiveDelta = playerStatusDelta(state, status, delta);
  const updated = setPlayerStatus(state, status, state.playerStatuses[status] + effectiveDelta);
  const thornsBonus =
    status === "block" && effectiveDelta > 0 && state.trinketEffects.ironwoodBucklerThornsOnBlock > 0
      ? state.trinketEffects.ironwoodBucklerThornsOnBlock
      : 0;
  const playerStatuses =
    thornsBonus > 0
      ? { ...updated.playerStatuses, thorns: updated.playerStatuses.thorns + thornsBonus }
      : updated.playerStatuses;
  const uniqueGear =
    status === "forge" &&
    effectiveDelta > 0 &&
    state.gearEffects.forgeReadiesPhysicalRepeat > 0 &&
    !state.action?.repeatActive &&
    !state.uniqueGear.everkeenReady
      ? { ...state.uniqueGear, everkeenReady: true }
      : state.uniqueGear;
  if (playerStatuses === updated.playerStatuses && uniqueGear === updated.uniqueGear) return updated;
  return { ...updated, playerStatuses, uniqueGear };
}

export function setPlayerStatus(state: BattleState, status: PlayerStatusId, value: number): BattleState {
  const pendingEnemyBleedLeechHealing =
    status === "bleed" ? Math.min(state.pendingEnemyBleedLeechHealing, value) : state.pendingEnemyBleedLeechHealing;
  const unchangedStatus = Object.is(state.playerStatuses[status], value);
  // Reapplying Bleed can still repair its pending Leech credit.
  if (unchangedStatus && Object.is(pendingEnemyBleedLeechHealing, state.pendingEnemyBleedLeechHealing)) return state;
  return {
    ...state,
    playerStatuses: unchangedStatus ? state.playerStatuses : { ...state.playerStatuses, [status]: value },
    pendingEnemyBleedLeechHealing,
  };
}

export function addEnemyStatus(
  state: BattleState,
  status: EnemyStatusId,
  delta: number,
  options: { attackBuildup?: boolean; combatTexts?: CombatTextEvent[] } = {},
): BattleState {
  if ((status === "stun" || status === "freeze") && isStunFreezeBuildupBlocked(state.enemyCC)) {
    return state;
  }
  const benefit =
    status === "stun"
      ? "thunderstruck"
      : status === "freeze"
        ? "bitter-cold"
        : status === "bleed"
          ? "deep-wounds"
          : null;
  if (options.attackBuildup !== false && delta > 0 && benefit && hasEncounterBenefit(state, benefit))
    delta *= LABYRINTH_MODIFIER_CONFIG.double;
  const traitAdjustedDelta =
    delta > 0 &&
    ((status === "stun" && hasEnemyTrait(state, "braced")) ||
      (status === "freeze" && hasEnemyTrait(state, "winterborn")))
      ? halveRounded(delta)
      : delta;
  let nextState = setEnemyStatus(state, status, state.enemyStatuses[status] + traitAdjustedDelta);

  if (
    status === "poison" &&
    traitAdjustedDelta > 0 &&
    rollPercent(nextState.gearEffects.poisonArmorShredChance, getBattleRng(nextState))
  ) {
    const armorBefore = nextState.enemyMitigation.armor;
    nextState = reduceEnemyArmor(nextState, 1);
    const removed = armorBefore - nextState.enemyMitigation.armor;
    if (removed > 0 && options.combatTexts) {
      mergeCombatText(options.combatTexts, {
        target: "enemy",
        kind: "damage",
        stat: "armor",
        amount: removed,
        impact: false,
      });
    }
  }

  return nextState;
}

export function setEnemyStatus(state: BattleState, status: EnemyStatusId, value: number): BattleState {
  const clearConsecration = status === "bleed" && value <= 0 && state.reactions.consecrated;
  if (Object.is(state.enemyStatuses[status], value) && !clearConsecration) return state;
  return {
    ...state,
    enemyStatuses: { ...state.enemyStatuses, [status]: value },
    ...(clearConsecration ? { reactions: { ...state.reactions, consecrated: false } } : {}),
  };
}
