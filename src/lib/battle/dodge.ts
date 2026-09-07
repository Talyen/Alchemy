import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import {
  ENEMY_DODGE_CHANCE,
  HALF_DIVISOR,
  PLAYER_DODGE_CHANCE,
  MAX_PLAYER_DODGE_CHANCE,
  STATUS_CONFIG,
  UNIQUE_GEAR_COMBAT,
} from "../game-constants";
import { mergeCombatText } from "./combat-text";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { hasEncounterBenefit, hasEnemyTrait, type BattleState, type CombatTextEvent } from "./types";

function getPlayerDodgeChance(
  state: Pick<
    BattleState,
    | "gearEffects"
    | "talentEffects"
    | "playerHealth"
    | "playerMaxHealth"
    | "playerStatuses"
    | "dodgeChanceFromDamage"
    | "uniqueGear"
    | "encounterBenefits"
  >,
): number {
  let chance =
    PLAYER_DODGE_CHANCE + state.gearEffects.dodgeChance + state.talentEffects.dodgeChance + state.dodgeChanceFromDamage;
  if (hasEncounterBenefit(state, "elusive")) chance += LABYRINTH_MODIFIER_CONFIG.playerDodgeBonus;
  if (state.gearEffects.archeryDodgeAndDraw > 0 && state.uniqueGear.wrenflightActive)
    chance += UNIQUE_GEAR_COMBAT.wrenflightDodgeChance;
  if (state.playerStatuses.block === 0) chance += state.talentEffects.dodgeChanceWithoutBlock;
  if (state.talentEffects.dodgeChanceBelowHalfHealth > 0 && state.playerHealth < state.playerMaxHealth / HALF_DIVISOR) {
    chance += state.talentEffects.dodgeChanceBelowHalfHealth;
  }
  return Math.min(MAX_PLAYER_DODGE_CHANCE, Math.max(0, chance));
}

function tryDodgePacket(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  options: { target: "player" | "enemy"; chance: number; canDodge: boolean },
): BattleState | null {
  if (!options.canDodge) return null;
  if (!rollPercent(options.chance, getBattleRng(state))) return null;
  mergeCombatText(combatTexts, {
    target: options.target,
    kind: "notice",
    stat: "dodge",
    text: STATUS_CONFIG.DODGE_NOTICE,
  });
  return options.target === "player"
    ? { ...state, playerDodgeCount: state.playerDodgeCount + 1, dodgeChanceFromDamage: 0 }
    : state;
}

export function tryDodgeEnemyAttackPacket(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  canDodge: boolean,
): BattleState | null {
  return tryDodgePacket(state, combatTexts, {
    target: "player",
    chance: getPlayerDodgeChance(state),
    canDodge,
  });
}

function enemyCanDodge(state: BattleState): boolean {
  if (state.gearEffects.poisonedAttacksPierce > 0 && state.enemyStatuses.poison > 0) return false;
  if (state.talentEffects.poisonPreventsEnemyDodge && state.enemyStatuses.poison > 0) return false;
  if (state.talentEffects.freezePreventsEnemyDodge && state.enemyCC.freezeSkipTurns > 0) return false;
  return true;
}

export function tryDodgePlayerAttackPacket(state: BattleState, combatTexts: CombatTextEvent[]): BattleState | null {
  return tryDodgePacket(state, combatTexts, {
    target: "enemy",
    chance: ENEMY_DODGE_CHANCE + (hasEnemyTrait(state, "elusive-foe") ? LABYRINTH_MODIFIER_CONFIG.enemyDodgeBonus : 0),
    canDodge: enemyCanDodge(state),
  });
}
