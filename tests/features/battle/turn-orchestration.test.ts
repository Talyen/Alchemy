import { describe, expect, it, vi } from "vitest";
import { resolveEndTurnOrchestration } from "@/features/alchemy/battle/turn-orchestration";
import { defaultBattleState } from "@/lib/battle";

vi.mock("@/features/alchemy/battle/turn-resolution-ui", () => ({
  resolveHasteSkipTurn: vi.fn(),
  resolveNormalEnemyTurn: vi.fn(),
  executeEnemyPhase: vi.fn(),
}));

import { resolveHasteSkipTurn, resolveNormalEnemyTurn } from "@/features/alchemy/battle/turn-resolution-ui";

function makeDeps() {
  const getStore = vi.fn(() => ({
    logicalBattleState: defaultBattleState(),
    setSyncedBattleState: vi.fn(),
    setLogicalBattleState: vi.fn(),
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
  it("routes haste turns to resolveHasteSkipTurn", () => {
    vi.mocked(resolveHasteSkipTurn).mockClear();
    vi.mocked(resolveNormalEnemyTurn).mockClear();

    const deps = makeDeps();
    const state = defaultBattleState();
    state.playerStatuses.haste = 1;

    resolveEndTurnOrchestration(deps, state, 1);

    expect(resolveHasteSkipTurn).toHaveBeenCalled();
    expect(resolveNormalEnemyTurn).not.toHaveBeenCalled();
  });

  it("routes normal turns to resolveNormalEnemyTurn", () => {
    vi.mocked(resolveHasteSkipTurn).mockClear();
    vi.mocked(resolveNormalEnemyTurn).mockClear();

    const deps = makeDeps();
    resolveEndTurnOrchestration(deps, defaultBattleState(), 1);

    expect(resolveNormalEnemyTurn).toHaveBeenCalled();
    expect(resolveHasteSkipTurn).not.toHaveBeenCalled();
  });
});
