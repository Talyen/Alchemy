import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  executeEnemyPhase,
  resolveEndTurn,
  resolveHasteSkipTurn,
  resolveNormalEnemyTurn,
  resumePendingBattleTransition,
  type BattleTurnSession,
  type TurnOrchestration,
} from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { defaultBattleState, endPlayerTurn, type BattleState } from "@/lib/battle";
import { runHandDrawSequence, type HandDrawSequenceDeps } from "@/features/alchemy/run-loop/battle/draw-sequence";
import type { PersistedBattleTransition } from "@/lib/active-run-session";

const beginBattleTransition = vi.fn();
const commitBattleTransition = vi.fn();
const clearBattleTransition = vi.fn();
const setBattleState = vi.fn();

vi.mock("@/features/alchemy/shared/stores/run-session-write-port", () => ({
  beginBattleTransition: (_draft: unknown, ...args: unknown[]) => beginBattleTransition(...args),
  commitBattleTransition: (_draft: unknown, ...args: unknown[]) => commitBattleTransition(...args),
  clearBattleTransition: (_draft: unknown, ...args: unknown[]) => clearBattleTransition(...args),
  setBattleState: (_draft: unknown, ...args: unknown[]) => setBattleState(...args),
}));

vi.mock("@/features/alchemy/run-loop/battle/draw-sequence", () => ({
  runHandDrawSequence: vi.fn(async (_oldHand, _newState, applyState) => {
    applyState();
    return true;
  }),
}));

vi.mock("@/lib/animation/game-timer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/animation/game-timer")>()),
  delay: vi.fn(async () => {}),
}));

vi.mock("@/lib/audio", () => ({
  playBattleEvent: vi.fn(),
  playEnemyAttack: vi.fn(),
}));

const presentation = {
  hiddenHandCardKeys: new Set<string>(),
  spawnCardGhost: vi.fn(),
  showCombatTexts: vi.fn(),
  shakePlayer: vi.fn(),
  hurtPlayer: vi.fn(),
  hurtEnemy: vi.fn(),
  shakeEnemy: vi.fn(),
  shakeCompanion: vi.fn(),
  resetHandTransferUi: vi.fn(),
  resetCardTransfers: vi.fn(),
  clearCardGhosts: vi.fn(),
  resetPortraitHurtTokens: vi.fn(),
  clearFloatingCombatTexts: vi.fn(),
  setCardTransfers: vi.fn(),
  setHiddenHandCardKeys: vi.fn(),
  setCardTransferInProgress: vi.fn(),
};

let domain: { battleState: BattleState; pendingBattleTransition: PersistedBattleTransition | null };

vi.mock("@/features/alchemy/shared/stores/run-session-read-port", () => ({
  readBattle: () => domain,
}));

vi.mock("@/features/alchemy/run-loop/battle/battle-presentation-store", () => ({
  useBattlePresentationStore: {
    getState: () => presentation,
  },
}));

function makeDrawDeps(): HandDrawSequenceDeps {
  return {
    isSessionActive: () => true,
    animateDrawnHand: vi.fn(async () => {}),
    setTransferInProgress: vi.fn(),
    setHiddenHandCardKeys: vi.fn(),
    runIfSessionActive: (_session, action) => action(),
  };
}

function makeSession(overrides: Partial<BattleTurnSession> = {}): BattleTurnSession {
  return {
    isCurrentBattleSession: () => true,
    runIfSessionActive: <T>(_session: number, action: () => T) => action(),
    checkBattleEnd: vi.fn(() => false),
    handleVictoryDefeat: vi.fn(),
    ...overrides,
  };
}

function makeOrch(): TurnOrchestration {
  return {
    getDrawSequenceDeps: () => makeDrawDeps(),
    logBattleError: vi.fn(),
    resetHandTransferUi: vi.fn(),
    scheduleCompanionFollowUp: vi.fn(),
    getPresentation: () => presentation,
  };
}

beforeEach(() => {
  domain = { battleState: defaultBattleState(), pendingBattleTransition: null };
  presentation.showCombatTexts.mockClear();
  presentation.shakePlayer.mockClear();
  presentation.hurtPlayer.mockClear();
  presentation.hurtEnemy.mockClear();
  presentation.shakeEnemy.mockClear();
  presentation.shakeCompanion.mockClear();
  beginBattleTransition.mockClear();
  commitBattleTransition.mockClear();
  clearBattleTransition.mockClear();
  setBattleState.mockClear();
  vi.mocked(runHandDrawSequence).mockClear();
});

describe("resolveHasteSkipTurn", () => {
  it("shows combat texts and runs the draw sequence", async () => {
    const state = defaultBattleState();
    const result = endPlayerTurn({ ...state, playerStatuses: { ...state.playerStatuses, haste: 1 } });
    const orch = makeOrch();

    resolveHasteSkipTurn(result, state, 1, makeSession(), orch, resolveEndTurn);

    await vi.waitFor(() => {
      expect(orch.scheduleCompanionFollowUp).toHaveBeenCalled();
      expect(orch.resetHandTransferUi).toHaveBeenCalled();
    });
    if (result.combatTexts.length > 0) {
      expect(presentation.showCombatTexts).toHaveBeenCalledWith(result.combatTexts);
    }
  });
});

describe("resolveNormalEnemyTurn", () => {
  it("commits a resumable continuation before presentation delays", () => {
    const state = defaultBattleState();
    const result = endPlayerTurn(state);
    if (result.kind === "haste") throw new Error("Expected an enemy-turn resolution");
    const orch = makeOrch();

    resolveNormalEnemyTurn(result, state, 1, makeSession(), orch, resolveEndTurn);

    expect(beginBattleTransition).toHaveBeenCalledWith(
      expect.objectContaining({ turnPhase: "enemy" }),
      {
        kind: "enemy-turn",
        resultState: result.state,
        playerTurnSkipped: result.playerTurnSkipped,
      },
      expect.objectContaining({ hand: [], turnPhase: "enemy" }),
    );
  });

  it("calls handleVictoryDefeat when the enemy is already dead", () => {
    const state = defaultBattleState();
    const result = endPlayerTurn(state);
    expect(result.kind).not.toBe("haste");
    if (result.kind === "haste") throw new Error("Expected an enemy-turn resolution");
    const deadResult = {
      ...result,
      kind: "standard" as const,
      state: { ...state, enemyHealth: 0, turnPhase: "enemy" as const },
    };
    const orch = makeOrch();
    const battleSession = makeSession();

    resolveNormalEnemyTurn(deadResult, state, 1, battleSession, orch, resolveEndTurn);

    expect(battleSession.handleVictoryDefeat).toHaveBeenCalledWith("victory");
    expect(commitBattleTransition).toHaveBeenCalled();
  });
});

describe("executeEnemyPhase", () => {
  it("shakes the player when enemy damage texts are present", async () => {
    const current = defaultBattleState();
    const result = { ...current, playerHealth: 5 };

    await executeEnemyPhase(
      result,
      current,
      [{ target: "player", kind: "damage", stat: "health", amount: 4 }],
      1,
      false,
      true,
      makeSession(),
      makeOrch(),
      resolveEndTurn,
    );

    expect(presentation.shakePlayer).toHaveBeenCalledOnce();
    expect(presentation.hurtPlayer).toHaveBeenCalledOnce();
    expect(presentation.showCombatTexts).toHaveBeenCalled();
  });

  it("does not hurt the player when only block absorb damage is present", async () => {
    const current = defaultBattleState();
    const result = { ...current, playerHealth: 5 };

    await executeEnemyPhase(
      result,
      current,
      [{ target: "player", kind: "damage", stat: "block", amount: 4 }],
      1,
      false,
      true,
      makeSession(),
      makeOrch(),
      resolveEndTurn,
    );

    expect(presentation.hurtPlayer).not.toHaveBeenCalled();
    expect(presentation.shakePlayer).toHaveBeenCalledOnce();
  });

  it("commits result state via the draw sequence applyState callback", async () => {
    const current = defaultBattleState();
    const result = { ...current, turn: 2, hand: current.hand };
    const orch = makeOrch();

    await executeEnemyPhase(result, current, [], 1, false, false, makeSession(), orch, resolveEndTurn);

    expect(runHandDrawSequence).toHaveBeenCalledOnce();
    const applyState = vi.mocked(runHandDrawSequence).mock.calls[0]![2];
    expect(typeof applyState).toBe("function");
    expect(commitBattleTransition).toHaveBeenCalledWith(result, null);
    expect(commitBattleTransition).toHaveBeenCalledTimes(1);
    expect(orch.scheduleCompanionFollowUp).toHaveBeenCalledWith(result, 1);
  });
});

describe("resumePendingBattleTransition", () => {
  it("commits the computed result without replaying animation delays", () => {
    const resultState = { ...defaultBattleState(), turn: 2, playerHealth: 18 };
    domain.pendingBattleTransition = {
      kind: "enemy-turn",
      resultState,
      playerTurnSkipped: false,
    };
    const orch = makeOrch();

    resumePendingBattleTransition(1, makeSession(), orch);

    expect(commitBattleTransition).toHaveBeenCalledWith(resultState, null);
    expect(orch.scheduleCompanionFollowUp).toHaveBeenCalledWith(resultState, 1);
  });

  it("recovers legacy enemy-phase markers into a playable player turn", () => {
    const enemyPhase = { ...defaultBattleState(), turnPhase: "enemy" as const, hand: [] };
    domain.battleState = enemyPhase;
    domain.pendingBattleTransition = { kind: "legacy-enemy-turn" };
    const orch = makeOrch();
    const battleSession = makeSession();

    resumePendingBattleTransition(1, battleSession, orch);

    expect(commitBattleTransition).toHaveBeenCalledOnce();
    const [recovered, continuation] = vi.mocked(commitBattleTransition).mock.calls[0]!;
    expect(continuation).toBeNull();
    expect(recovered.turnPhase).toBe("player");
    expect(battleSession.checkBattleEnd).toHaveBeenCalledWith(recovered, 1);
  });
});
