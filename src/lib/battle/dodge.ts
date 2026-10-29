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
import { emitNoticeText } from "./combat-text-events";
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
  if (hasEncounterBenefit(state, "elusive")) chance += LABYRINTH_MODIFIER_CONFIG.playerDodgeBonusPercent;
  if (state.gearEffects.archeryDodgeAndDraw > 0 && state.uniqueGear.wrenflightActive)
    chance += UNIQUE_GEAR_COMBAT.wrenflightDodgeChancePercent;
  if (state.playerHealth < state.playerMaxHealth / HALF_DIVISOR) {
    chance += state.talentEffects.dodgeChanceBelowHalfHealth + state.gearEffects.dodgeChanceBelowHalfHealth;
  }
  return clamp(chance, 0, MAX_PLAYER_DODGE_CHANCE_PERCENT);
}

function tryDodgePacket(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  options: { target: "player" | "enemy"; chance: number; canDodge: boolean; feedback?: CombatTextEvent["feedback"] },
): BattleState | null {
  if (!options.canDodge) return null;
  if (!rollPercent(options.chance, getBattleRng(state), "dodge")) return null;
  emitNoticeText(combatTexts, options.target, "dodge", STATUS_CONFIG.DODGE_NOTICE, {
    ...(options.feedback ? { feedback: options.feedback } : {}),
  });
  return options.target === "player"
    ? { ...state, playerDodgeCount: state.playerDodgeCount + 1, dodgeChanceFromDamage: 0 }
    : state;
}

export function tryDodgeEnemyAttackPacket(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  canDodge: boolean,
): { state: BattleState; dodged: boolean } {
  const eligible = canDodge && state.playerCC.stunSkipTurns <= 0 && state.playerCC.freezeSkipTurns <= 0;
  if (!eligible) return { state, dodged: false };

  const chance = Math.max(getPlayerDodgeChance(state), state.flags.dodgeNextAttackChance);
  const guaranteed = state.flags.dodgeNextAttack;
  // Spend preparations before rewards can legitimately arm a new attempt.
  const attempted =
    guaranteed || state.flags.dodgeNextAttackChance > 0
      ? { ...state, flags: { ...state.flags, dodgeNextAttack: false, dodgeNextAttackChance: 0 } }
      : state;

  if (guaranteed) {
    emitNoticeText(combatTexts, "player", "dodge", STATUS_CONFIG.DODGE_NOTICE);
    return {
      state: { ...attempted, playerDodgeCount: state.playerDodgeCount + 1, dodgeChanceFromDamage: 0 },
      dodged: true,
    };
  }

  const dodged = tryDodgePacket(attempted, combatTexts, {
    target: "player",
    chance,
    canDodge: true,
  });
  return { state: dodged ?? attempted, dodged: dodged !== null };
}

function enemyCanDodge(state: BattleState): boolean {
  if (state.enemyCC.stunSkipTurns > 0 || state.enemyCC.freezeSkipTurns > 0) return false;
  return !(
    state.enemyStatuses.poison > 0 &&
    (state.gearEffects.poisonedAttacksPierce > 0 || state.talentEffects.poisonPreventsEnemyDodge)
  );
}

export function tryDodgePlayerAttackPacket(
  state: BattleState,
  combatTexts: CombatTextEvent[],
  feedback?: CombatTextEvent["feedback"],
): BattleState | null {
  return tryDodgePacket(state, combatTexts, {
    target: "enemy",
    chance:
      ENEMY_DODGE_CHANCE_PERCENT +
      (hasEnemyTrait(state, "elusive-foe") ? LABYRINTH_MODIFIER_CONFIG.enemyDodgeBonusPercent : 0),
    canDodge: enemyCanDodge(state),
    ...(feedback ? { feedback } : {}),
  });
}
