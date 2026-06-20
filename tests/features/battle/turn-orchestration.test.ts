import { describe, expect, it, vi } from "vitest";
import { resolveEndTurn } from "@/features/alchemy/run-loop/battle/turn-orchestration";
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
    setDisplayOverrides: vi.fn(),
    shakeCompanion: vi.fn(),
  }));

  return {
    getStore,
    isCurrentBattleSession: () => true,
    runIfSessionActive: <T>(_session: number, action: () => T) => action(),
    checkBattleEnd: vi.fn(() => false),
    handleVictoryDefeat: vi.fn(),
    getDrawSequenceDeps: vi.fn(),
    logBattleError: vi.fn(),
    resetHandTransferUi: vi.fn(),
    scheduleCompanionFollowUp: vi.fn(),
  };
}

describe("resolveEndTurn", () => {
  it("does not sync battle state before the haste draw sequence", () => {
    const deps = makeDeps();
    const state = defaultBattleState();
    state.playerStatuses.haste = 1;

    resolveEndTurn(state, 1, deps);

    expect(deps.getStore().setSyncedBattleState).not.toHaveBeenCalled();
  });
});
