import type { BattleState } from "@/lib/battle";
import { getEnemyAbilityPressure } from "@/lib/battle/battle-enemy-setup";
import { enemyById } from "@/lib/game-data/compendium";
import { makeTestBattleState } from "./battle";

/** Isolate native enemy mechanics from encounter pressure unless a test supplies it. */
export function enemyState(id = "skeleton", overrides: Partial<BattleState> = {}): BattleState {
  const enemy = enemyById[id];
  if (!enemy) throw new Error(`Unknown enemy ${id}`);
  const state = makeTestBattleState({
    currentEnemy: enemy,
    playerHealth: 100,
    playerMaxHealth: 100,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    rng: () => 0.99,
    ...overrides,
  });
  return {
    ...state,
    difficultyModifiers: state.difficultyModifiers.some((modifier) => modifier.kind === "enemy-damage-multiplier")
      ? state.difficultyModifiers
      : [{ kind: "enemy-damage-multiplier", amount: 1 / getEnemyAbilityPressure(state) }, ...state.difficultyModifiers],
  };
}
