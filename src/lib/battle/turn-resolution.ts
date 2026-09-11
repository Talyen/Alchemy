import { endPlayerTurn, type EndPlayerTurnResolution } from "./enemy-turn";
import { processCompanionTurnStart } from "./companion";
import {
  battleSnapshot,
  isPlayerDefeated,
  type BattleResolutionContext,
  type BattleSnapshot,
  type BattleState,
  type CombatTextEvent,
} from "./types";

export interface BattleTurnFrame {
  before: BattleSnapshot;
  turn: EndPlayerTurnResolution<BattleSnapshot>;
  companion: { id: string; texts: CombatTextEvent[]; state: BattleSnapshot } | null;
}

export interface ResolvedBattleTurn {
  state: BattleSnapshot;
  frames: BattleTurnFrame[];
}

function snapshotTurn(turn: EndPlayerTurnResolution): EndPlayerTurnResolution<BattleSnapshot> {
  const { afterAbilityState, ...result } = turn;
  const state = battleSnapshot(turn.state);
  const afterAbility = afterAbilityState ? { afterAbilityState: battleSnapshot(afterAbilityState) } : {};
  return result.kind === "haste"
    ? { ...result, state, ...afterAbility }
    : { ...result, state, enemyTurnStartState: battleSnapshot(result.enemyTurnStartState), ...afterAbility };
}

/** Resolve until input is possible again; presentation never advances combat or draws RNG. */
export function resolveBattleTurn(snapshot: BattleSnapshot, context: BattleResolutionContext): ResolvedBattleTurn {
  let state: BattleState = { ...snapshot, ...context };
  const frames: BattleTurnFrame[] = [];
  while (state.enemyHealth > 0 && !isPlayerDefeated(state)) {
    const before = battleSnapshot(state);
    const turn = endPlayerTurn(state);
    state = turn.state;
    let companion: BattleTurnFrame["companion"] = null;
    if (!turn.playerTurnSkipped && state.enemyHealth > 0 && !isPlayerDefeated(state) && state.activeCompanion) {
      const id = state.activeCompanion.id;
      const texts: CombatTextEvent[] = [];
      state = processCompanionTurnStart(state, texts);
      companion = { id, texts, state: battleSnapshot(state) };
    }
    frames.push({ before, turn: snapshotTurn(turn), companion });
    if (!turn.playerTurnSkipped) break;
  }
  return { state: battleSnapshot(state), frames };
}
