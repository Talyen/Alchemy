import { FLAG_DEFINITIONS } from "./combat-flags";
import type { BattleState, CombatFlags } from "./types/state-types";

export type SecondaryActionSource = "companion" | "repeat" | "delayed-card" | "retaliation" | "reward";

/** Execution scope, never persisted. Secondary actions cannot spend a played card's bonuses. */
export interface BattleActionContext {
  source: SecondaryActionSource;
  cardBonuses: "ineligible";
  repeatActive: boolean;
}

interface ActionState {
  flags: CombatFlags;
  action?: BattleActionContext;
}

export function readCombatFlag<K extends keyof CombatFlags>(state: ActionState, key: K): CombatFlags[K] {
  const unavailable = FLAG_DEFINITIONS[key].secondaryValue;
  return (
    state.action?.cardBonuses === "ineligible" && unavailable !== null ? unavailable : state.flags[key]
  ) as CombatFlags[K];
}

export function writeCombatFlag<K extends keyof CombatFlags>(
  state: BattleState,
  key: K,
  value: CombatFlags[K],
): BattleState {
  if (state.action?.cardBonuses === "ineligible" && FLAG_DEFINITIONS[key].secondaryValue !== null) {
    // A reaction may earn a future discount, but cannot spend an existing one.
    if (key !== "nextCardCostReduction") return state;
    value = Math.max(state.flags.nextCardCostReduction, value as number) as CombatFlags[K];
  }
  return { ...state, flags: { ...state.flags, [key]: value } };
}

export function resolveSecondaryAction(
  state: BattleState,
  source: SecondaryActionSource,
  resolve: (state: BattleState) => BattleState,
): BattleState {
  const result = resolve({
    ...state,
    action: {
      source,
      cardBonuses: "ineligible",
      repeatActive: source === "repeat" || state.action?.repeatActive === true,
    },
  });
  // Only execution metadata is restored; gameplay flags are never masked or copied back.
  if (state.action) return { ...result, action: state.action };
  const { action: _action, ...completed } = result;
  return completed;
}
