import "../../../../helpers/mock-audio";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  executeEnemyPhase,
  persistEnemyTurnTransition,
  resolveEndTurn,
  resolveHasteSkipTurn,
  resolveNormalEnemyTurn,
  resumePendingBattleTransition,
} from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { defaultBattleState, endPlayerTurn, type BattleState } from "@/lib/battle";
import { companionLibrary } from "@/lib/game-data";
import { runHandDrawSequence } from "@/features/alchemy/run-loop/battle/draw-sequence";
import type { PersistedBattleTransition } from "@/lib/active-run-session";
import {
  makeBattleTurnSession,
  makeDrawSequenceDeps,
  makePresentationPort,
  makeTurnOrchestration,
} from "./turn-orchestration-fixture";

const beginBattleTransition = vi.fn();
const commitBattleTransition = vi.fn();
const clearBattleTransition = vi.fn();
const setBattleState = vi.fn();

vi.mock("@/features/alchemy/shared/stores/run-session-write-port", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/shared/stores/run-session-write-port")>();
  return {
    ...actual,
    beginBattleTransition: (_draft: unknown, ...args: unknown[]) => beginBattleTransition(...args),
    commitBattleTransition: (_draft: unknown, ...args: unknown[]) => commitBattleTransition(...args),
    clearBattleTransition: (_draft: unknown, ...args: unknown[]) => clearBattleTransition(...args),
    setBattleState: (_draft: unknown, ...args: unknown[]) => setBattleState(...args),
  };
});

vi.mock("@/features/alchemy/run-loop/battle/draw-sequence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/run-loop/battle/draw-sequence")>();
  return {
    ...actual,
    runHandDrawSequence: vi.fn(async (_oldHand, _newState, applyState) => {
      applyState();
      return true;
    }),
  };
});

vi.mock("@/lib/animation/game-timer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/animation/game-timer")>()),
  delay: vi.fn(async () => {}),
}));

const presentation = makePresentationPort();

let domain: { battleState: BattleState; pendingBattleTransition: PersistedBattleTransition | null };

vi.mock("@/features/alchemy/shared/stores/run-session-read-port", () => ({
  readBattle: () => domain,
}));

vi.mock("@/features/alchemy/run-loop/battle/battle-presentation-store", () => ({
  useBattlePresentationStore: {
    getState: () => presentation,
  },
}));

function makeOrch() {
  return makeTurnOrchestration({ getDrawSequenceDeps: () => makeDrawSequenceDeps() }, presentation);
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

describe("resolveEndTurn", () => {
  it("commits haste state in the end-turn command before draw applyState", () => {
    const order: string[] = [];
    commitBattleTransition.mockImplementation(() => {
      order.push("commit");
    });
    vi.mocked(runHandDrawSequence).mockImplementationOnce(
      async (_oldHand, _newState, applyState, session, drawDeps) => {
        drawDeps.runIfSessionActive(session, () => {
          applyState();
          order.push("apply");
        });
        return true;
      },
    );
    const state = defaultBattleState();
    state.playerStatuses.haste = 1;

    resolveEndTurn(state, 1, makeBattleTurnSession(), makeOrch());

    expect(order).toEqual(["commit", "apply"]);
    expect(commitBattleTransition).toHaveBeenCalledOnce();
  });

  it("does not apply companion effects before the enemy turn", () => {
    const orch = makeOrch();
    const battleSession = makeBattleTurnSession();
    const state = defaultBattleState();
    state.activeCompanion = companionLibrary.wolf;
    const enemyHealth = state.enemyHealth;

    resolveEndTurn(state, 1, battleSession, orch);

    expect(battleSession.handleVictoryDefeat).not.toHaveBeenCalled();
    expect(beginBattleTransition.mock.calls[0]?.[0]?.enemyHealth).toBe(enemyHealth);
  });

  it("returns false without dispatching when the session is stale", () => {
    const battleSession = makeBattleTurnSession({ isCurrentBattleSession: () => false });
    const started = resolveEndTurn(defaultBattleState(), 1, battleSession, makeOrch());
    expect(started).toBe(false);
    expect(battleSession.handleVictoryDefeat).not.toHaveBeenCalled();
    expect(beginBattleTransition).not.toHaveBeenCalled();
    expect(commitBattleTransition).not.toHaveBeenCalled();
  });

  it("short-circuits to victory when the enemy is already dead", () => {
    const battleSession = makeBattleTurnSession();
    const state = defaultBattleState();
    state.enemyHealth = 0;
    expect(resolveEndTurn(state, 1, battleSession, makeOrch())).toBe(false);
    expect(battleSession.handleVictoryDefeat).toHaveBeenCalledWith("victory");
    expect(beginBattleTransition).not.toHaveBeenCalled();
  });

  it("short-circuits to defeat when the player is already defeated", () => {
    const battleSession = makeBattleTurnSession();
    const state = defaultBattleState();
    state.playerHealth = 0;
    state.deathsDoorActive = false;
    expect(resolveEndTurn(state, 1, battleSession, makeOrch())).toBe(false);
    expect(battleSession.handleVictoryDefeat).toHaveBeenCalledWith("defeat");
  });

  it("dispatches a skipped enemy turn when the enemy is CC-locked", () => {
    const state = defaultBattleState();
    state.enemyCC.stunSkipTurns = 1;
    expect(resolveEndTurn(state, 1, makeBattleTurnSession(), makeOrch())).toBe(false);
    expect(beginBattleTransition).toHaveBeenCalledOnce();
  });
});

describe("resolveHasteSkipTurn", () => {
  it("shows combat texts and runs the draw sequence", async () => {
    const state = defaultBattleState();
    const result = endPlayerTurn({ ...state, playerStatuses: { ...state.playerStatuses, haste: 1 } });
    const orch = makeOrch();

    resolveHasteSkipTurn(result, state, 1, makeBattleTurnSession(), orch, resolveEndTurn);

    await vi.waitFor(() => {
      expect(orch.scheduleCompanionFollowUp).toHaveBeenCalled();
      expect(orch.scheduleAutoEndTurn).toHaveBeenCalledWith(result.state);
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

    persistEnemyTurnTransition({} as never, result, state);
    resolveNormalEnemyTurn(result, state, 1, makeBattleTurnSession(), orch, resolveEndTurn);

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
    const battleSession = makeBattleTurnSession();

    persistEnemyTurnTransition({} as never, deadResult, state);
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
      makeBattleTurnSession(),
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
      makeBattleTurnSession(),
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

    await executeEnemyPhase(result, current, [], 1, false, false, makeBattleTurnSession(), orch, resolveEndTurn);

    expect(runHandDrawSequence).toHaveBeenCalledOnce();
    const applyState = vi.mocked(runHandDrawSequence).mock.calls[0]![2];
    expect(typeof applyState).toBe("function");
    expect(commitBattleTransition).toHaveBeenCalledWith(result, null);
    expect(commitBattleTransition).toHaveBeenCalledTimes(1);
    expect(orch.scheduleCompanionFollowUp).toHaveBeenCalledWith(result, 1);
    expect(orch.scheduleAutoEndTurn).toHaveBeenCalledWith(result);
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

    resumePendingBattleTransition(1, makeBattleTurnSession(), orch);

    expect(commitBattleTransition).toHaveBeenCalledWith(resultState, null);
    expect(orch.scheduleCompanionFollowUp).toHaveBeenCalledWith(resultState, 1);
    expect(orch.scheduleAutoEndTurn).toHaveBeenCalledWith(resultState);
  });

  it("no-ops when the session is stale or nothing is pending", () => {
    const stale = makeBattleTurnSession({ isCurrentBattleSession: () => false });
    domain.pendingBattleTransition = { kind: "continue-end-turn" };
    resumePendingBattleTransition(1, stale, makeOrch());
    expect(clearBattleTransition).not.toHaveBeenCalled();

    domain.pendingBattleTransition = null;
    resumePendingBattleTransition(1, makeBattleTurnSession(), makeOrch());
    expect(clearBattleTransition).not.toHaveBeenCalled();
    expect(commitBattleTransition).not.toHaveBeenCalled();
  });

  it("clears a continue-end-turn marker and re-enters resolveEndTurn", () => {
    const battleSession = makeBattleTurnSession();
    const state = defaultBattleState();
    state.enemyHealth = 0;
    domain.battleState = state;
    domain.pendingBattleTransition = { kind: "continue-end-turn" };

    resumePendingBattleTransition(1, battleSession, makeOrch());

    expect(clearBattleTransition).toHaveBeenCalledOnce();
    expect(battleSession.handleVictoryDefeat).toHaveBeenCalledWith("victory");
  });

  it("recovers legacy enemy-phase markers into a playable player turn", () => {
    const enemyPhase = { ...defaultBattleState(), turnPhase: "enemy" as const, hand: [] };
    domain.battleState = enemyPhase;
    domain.pendingBattleTransition = { kind: "legacy-enemy-turn" };
    const orch = makeOrch();
    const battleSession = makeBattleTurnSession();

    resumePendingBattleTransition(1, battleSession, orch);

    expect(commitBattleTransition).toHaveBeenCalledOnce();
    const [recovered, continuation] = vi.mocked(commitBattleTransition).mock.calls[0]!;
    expect(continuation).toBeNull();
    expect(recovered.turnPhase).toBe("player");
    expect(battleSession.checkBattleEnd).toHaveBeenCalledWith(recovered, 1);
  });
});
