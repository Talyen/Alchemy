import {
  ENEMY_DODGE_CHANCE_PERCENT,
  HALF_DIVISOR,
  LABYRINTH_MODIFIER_CONFIG,
  MAX_PLAYER_DODGE_CHANCE_PERCENT,
  PLAYER_DODGE_CHANCE_PERCENT,
  STATUS_CONFIG,
  UNIQUE_GEAR_COMBAT,
} from "../game-constants";
import { clamp } from "../math";
import { mergeCombatText } from "./combat-text-events";
import { getBattleRng, rollPercent } from "@/lib/rng";
import type { BattleState, CombatTextEvent } from "./types";
import { hasEncounterBenefit, hasEnemyTrait } from "./encounter-trait-state";

function getPlayerDodgeChance(
  state: Pick<
    BattleState,
    | "gearEffects"
    | "talentEffects"
    | "playerHealth"
    | "playerMaxHealth"
    | "playerStatuses"
    | "enemyStatuses"
    | "dodgeChanceFromDamage"
    | "uniqueGear"
    | "encounterBenefits"
  >,
): number {
  let chance =
    PLAYER_DODGE_CHANCE_PERCENT +
    state.gearEffects.dodgeChance +
    state.talentEffects.dodgeChance +
    state.dodgeChanceFromDamage;
  if (state.enemyStatuses.burn > 0) chance += state.talentEffects.dodgeChanceWhileEnemyBurning;
  if (hasEncounterBenefit(state, "elusive")) chance += LABYRINTH_MODIFIER_CONFIG.playerDodgeBonusPercent;
  if (state.gearEffects.archeryDodgeAndDraw > 0 && state.uniqueGear.wrenflightActive)
    chance += UNIQUE_GEAR_COMBAT.wrenflightDodgeChancePercent;
  if (state.playerStatuses.block === 0) chance += state.talentEffects.dodgeChanceWithoutBlock;
  if (state.talentEffects.dodgeChanceBelowHalfHealth > 0 && state.playerHealth < state.playerMaxHealth / HALF_DIVISOR) {
    chance += state.talentEffects.dodgeChanceBelowHalfHealth;
  }
  return clamp(chance, 0, MAX_PLAYER_DODGE_CHANCE_PERCENT);
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
  const eligible = canDodge && state.playerCC.stunSkipTurns <= 0 && state.playerCC.freezeSkipTurns <= 0;
  if (!eligible) return null;

  if (state.flags.dodgeNextAttack) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "notice",
      stat: "dodge",
      text: STATUS_CONFIG.DODGE_NOTICE,
    });
    return {
      ...state,
      flags: { ...state.flags, dodgeNextAttack: false },
      playerDodgeCount: state.playerDodgeCount + 1,
      dodgeChanceFromDamage: 0,
    };
  }

  return tryDodgePacket(state, combatTexts, {
    target: "player",
    chance: getPlayerDodgeChance(state),
    canDodge: true,
  });
}

function enemyCanDodge(state: BattleState): boolean {
  if (state.enemyCC.stunSkipTurns > 0 || state.enemyCC.freezeSkipTurns > 0) return false;
  return !(
    state.enemyStatuses.poison > 0 &&
    (state.gearEffects.poisonedAttacksPierce > 0 || state.talentEffects.poisonPreventsEnemyDodge)
  );
}

export function tryDodgePlayerAttackPacket(state: BattleState, combatTexts: CombatTextEvent[]): BattleState | null {
  return tryDodgePacket(state, combatTexts, {
    target: "enemy",
    chance:
      ENEMY_DODGE_CHANCE_PERCENT +
      (hasEnemyTrait(state, "elusive-foe") ? LABYRINTH_MODIFIER_CONFIG.enemyDodgeBonusPercent : 0),
    canDodge: enemyCanDodge(state),
  });
}
