import { ENEMY_DODGE_CHANCE, HALF_DIVISOR, PLAYER_DODGE_CHANCE, STATUS_CONFIG } from "../game-constants";
import { mergeCombatText } from "./combat-text";
import { getBattleRng, rollPercent } from "@/lib/rng";
import type { BattleState, CombatTextEvent } from "./types";

function getPlayerDodgeChance(
  state: Pick<BattleState, "gearEffects" | "talentEffects" | "playerHealth" | "playerMaxHealth">,
): number {
  let chance = PLAYER_DODGE_CHANCE + state.gearEffects.dodgeChance;
  if (
    state.talentEffects.dodgeChanceBelowHalfHealth > 0 &&
    state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR
  ) {
    chance += state.talentEffects.dodgeChanceBelowHalfHealth;
  }
  return chance;
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
  return state;
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
  if (state.talentEffects.poisonPreventsEnemyDodge && state.enemyStatuses.poison > 0) return false;
  if (state.talentEffects.freezePreventsEnemyDodge && state.enemyCC.freezeSkipTurns > 0) return false;
  return true;
}

export function tryDodgePlayerAttackPacket(state: BattleState, combatTexts: CombatTextEvent[]): BattleState | null {
  return tryDodgePacket(state, combatTexts, {
    target: "enemy",
    chance: ENEMY_DODGE_CHANCE,
    canDodge: enemyCanDodge(state),
  });
}
