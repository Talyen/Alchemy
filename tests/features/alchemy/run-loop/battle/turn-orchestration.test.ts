import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveEndTurn } from "@/features/alchemy/run-loop/battle/turn-orchestration";
import type { TurnOrchestration } from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { defaultBattleState } from "@/lib/battle";

const commitBattleTransition = vi.fn();
const setBattleState = vi.fn();
const beginBattleTransition = vi.fn();
const clearBattleTransition = vi.fn();

vi.mock("@/features/alchemy/shared/stores/run-session-write-port", () => ({
  commitBattleTransition: (...args: unknown[]) => commitBattleTransition(...args),
  setBattleState: (...args: unknown[]) => setBattleState(...args),
  beginBattleTransition: (...args: unknown[]) => beginBattleTransition(...args),
  clearBattleTransition: (...args: unknown[]) => clearBattleTransition(...args),
}));

const showCombatTexts = vi.fn();
const shakeCompanion = vi.fn();

vi.mock("@/features/alchemy/run-loop/battle/battle-session", () => ({
  getBattleSessionStore: () => ({
    battleState: defaultBattleState(),
    showCombatTexts,
    shakeCompanion,
    shakeEnemy: vi.fn(),
    shakePlayer: vi.fn(),
    hurtEnemy: vi.fn(),
    hurtPlayer: vi.fn(),
    pendingBattleTransition: null,
  }),
}));

vi.mock("@/features/alchemy/run-loop/battle/draw-sequence", () => ({
  runHandDrawSequence: vi.fn(() => Promise.resolve()),
}));

function makeOrch(): TurnOrchestration {
  return {
    isCurrentBattleSession: () => true,
    runIfSessionActive: <T>(_session: number, action: () => T) => action(),
    checkBattleEnd: vi.fn(() => false),
    handleVictoryDefeat: vi.fn(),
    getDrawSequenceDeps: vi.fn(() => ({}) as never),
    logBattleError: vi.fn(),
    resetHandTransferUi: vi.fn(),
    scheduleCompanionFollowUp: vi.fn(),
  };
}

describe("resolveEndTurn", () => {
  beforeEach(() => {
    commitBattleTransition.mockClear();
    setBattleState.mockClear();
    beginBattleTransition.mockClear();
    clearBattleTransition.mockClear();
    showCombatTexts.mockClear();
  });

  it("commits logical state before the haste draw sequence", () => {
    const orch = makeOrch();
    const state = defaultBattleState();
    state.playerStatuses.haste = 1;

    resolveEndTurn(state, 1, orch);

    expect(commitBattleTransition).toHaveBeenCalledOnce();
  });
});
