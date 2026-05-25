// Type guard to check if an unknown value matches the BattleState shape for persisted data validation.
// Extracted from active-run.ts to break the circular dependency: save-schemas → active-run → save-schemas.
import { type BattleState } from "@/lib/battle";

export function isPersistedBattleState(value: unknown): value is BattleState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<BattleState>;
  return (
    Array.isArray(state.deck) &&
    Array.isArray(state.hand) &&
    Array.isArray(state.discard) &&
    Array.isArray(state.exhausted) &&
    typeof state.mana === "number" &&
    typeof state.maxMana === "number" &&
    typeof state.gold === "number" &&
    typeof state.turn === "number" &&
    (state.turnPhase === "player" || state.turnPhase === "enemy") &&
    typeof state.playerHealth === "number" &&
    typeof state.playerMaxHealth === "number" &&
    typeof state.enemyHealth === "number" &&
    typeof state.enemyMaxHealth === "number" &&
    Boolean(state.currentEnemy) &&
    typeof state.currentEnemy === "object" &&
    Array.isArray(state.enemyAttackEffects) &&
    Boolean(state.playerStatuses) &&
    Boolean(state.enemyStatuses) &&
    Boolean(state.flags) &&
    Array.isArray(state.discoveredCardIds) &&
    Array.isArray(state.difficultyModifiers)
  );
}
