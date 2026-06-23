// Type guard to check if an unknown value matches the BattleState shape for persisted data validation.
// Extracted from active-run.ts to break the circular dependency: save-schemas → active-run → save-schemas.
import { type BattleState } from "@/lib/battle";

function hasValidArrays(state: Partial<BattleState>): boolean {
  return (
    Array.isArray(state.deck) &&
    Array.isArray(state.hand) &&
    Array.isArray(state.discard) &&
    Array.isArray(state.exhausted) &&
    Array.isArray(state.enemyAttackEffects) &&
    Array.isArray(state.discoveredCardIds) &&
    Array.isArray(state.difficultyModifiers)
  );
}

function hasValidNumbers(state: Partial<BattleState>): boolean {
  return (
    typeof state.mana === "number" &&
    typeof state.maxMana === "number" &&
    typeof state.gold === "number" &&
    typeof state.turn === "number" &&
    typeof state.playerHealth === "number" &&
    typeof state.playerMaxHealth === "number" &&
    typeof state.enemyHealth === "number" &&
    typeof state.enemyMaxHealth === "number"
  );
}

function hasValidObjects(state: Partial<BattleState>): boolean {
  return (
    Boolean(state.currentEnemy) &&
    typeof state.currentEnemy === "object" &&
    Boolean(state.playerStatuses) &&
    Boolean(state.enemyStatuses) &&
    Boolean(state.flags)
  );
}

export function isPersistedBattleState(value: unknown): value is BattleState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<BattleState>;
  return (
    hasValidArrays(state) &&
    hasValidNumbers(state) &&
    hasValidObjects(state) &&
    (state.turnPhase === "player" || state.turnPhase === "enemy")
  );
}
