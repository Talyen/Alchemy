import { describe, expect, it, vi } from "vitest";
import { resolveEndTurnOrchestration } from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { defaultBattleState } from "@/lib/battle";

function makeDeps() {
  const getStore = vi.fn(() => ({
    battleState: defaultBattleState(),
    setSyncedBattleState: vi.fn(),
    showCombatTexts: vi.fn(),
    shakeEnemy: vi.fn(),
    shakePlayer: vi.fn(),
    hurtEnemy: vi.fn(),
    hurtPlayer: vi.fn(),
  }));

  return {
    getStore,
    isCurrentBattleSession: () => true,
    runIfSessionActive: <T,>(_session: number, action: () => T) => action(),
    checkBattleEnd: vi.fn(() => false),
    handleVictoryDefeat: vi.fn(),
    getTurnResolutionStore: vi.fn(),
    getDrawSequenceDeps: vi.fn(),
    logBattleError: vi.fn(),
    companionScheduledRef: { current: false },
    battleTimerGroupRef: { current: { clearAll: vi.fn() } },
    resolvedAsHasteOrStunRef: { current: false },
    cardPlayInProgressRef: { current: false },
    resetHandTransferUi: vi.fn(),
    scheduleCompanionFollowUp: vi.fn(),
    onResolveEndTurn: vi.fn(),
  };
}

describe("resolveEndTurnOrchestration", () => {
  it("does not sync battle state before the haste draw sequence", () => {
    const deps = makeDeps();
    const state = defaultBattleState();
    state.playerStatuses.haste = 1;

    resolveEndTurnOrchestration(deps, state, 1);

    expect(deps.getStore().setSyncedBattleState).not.toHaveBeenCalled();
  });
});
