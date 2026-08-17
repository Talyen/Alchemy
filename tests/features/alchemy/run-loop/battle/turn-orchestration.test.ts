import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  resolveEndTurn,
  resumePendingBattleTransition,
  type BattleTurnSession,
  type TurnOrchestration,
} from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { defaultBattleState, type BattleState } from "@/lib/battle";
import { companionLibrary } from "@/lib/game-data";
import type { PersistedBattleTransition } from "@/lib/active-run-session";

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

vi.mock("@/features/alchemy/run-loop/battle/draw-sequence", () => ({
  runHandDrawSequence: vi.fn(() => Promise.resolve()),
}));

let domain: { battleState: BattleState; pendingBattleTransition: PersistedBattleTransition | null };

vi.mock("@/features/alchemy/shared/stores/run-session-read-port", () => ({
  readBattle: () => domain,
}));

function makeSession(overrides: Partial<BattleTurnSession> = {}): BattleTurnSession {
  return {
    isCurrentBattleSession: () => true,
    runIfSessionActive: <T>(_session: number, action: () => T) => action(),
    checkBattleEnd: vi.fn(() => false),
    handleVictoryDefeat: vi.fn(),
    ...overrides,
  };
}

function makeOrch(overrides: Partial<TurnOrchestration> = {}): TurnOrchestration {
  return {
    getDrawSequenceDeps: vi.fn(() => ({}) as never),
    logBattleError: vi.fn(),
    resetHandTransferUi: vi.fn(),
    scheduleCompanionFollowUp: vi.fn(),
    getPresentation: () => ({
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
    }),
    ...overrides,
  };
}

describe("resolveEndTurn", () => {
  beforeEach(() => {
    domain = { battleState: defaultBattleState(), pendingBattleTransition: null };
    commitBattleTransition.mockClear();
    setBattleState.mockClear();
    beginBattleTransition.mockClear();
    clearBattleTransition.mockClear();
  });

  it("commits logical state before the haste draw sequence", () => {
    const orch = makeOrch();
    const state = defaultBattleState();
    state.playerStatuses.haste = 1;

    resolveEndTurn(state, 1, makeSession(), orch);

    expect(commitBattleTransition).toHaveBeenCalledOnce();
  });

  it("does not apply companion effects before the enemy turn", () => {
    const orch = makeOrch();
    const battleSession = makeSession();
    const state = defaultBattleState();
    state.activeCompanion = companionLibrary.wolf;
    const enemyHealth = state.enemyHealth;

    resolveEndTurn(state, 1, battleSession, orch);

    expect(battleSession.handleVictoryDefeat).not.toHaveBeenCalled();
    expect(beginBattleTransition.mock.calls[0]?.[1]?.enemyHealth).toBe(enemyHealth);
  });

  it("returns false without dispatching when the session is stale", () => {
    const battleSession = makeSession({ isCurrentBattleSession: () => false });
    const started = resolveEndTurn(defaultBattleState(), 1, battleSession, makeOrch());
    expect(started).toBe(false);
    expect(battleSession.handleVictoryDefeat).not.toHaveBeenCalled();
    expect(beginBattleTransition).not.toHaveBeenCalled();
    expect(commitBattleTransition).not.toHaveBeenCalled();
  });

  it("short-circuits to victory when the enemy is already dead", () => {
    const battleSession = makeSession();
    const state = defaultBattleState();
    state.enemyHealth = 0;
    expect(resolveEndTurn(state, 1, battleSession, makeOrch())).toBe(false);
    expect(battleSession.handleVictoryDefeat).toHaveBeenCalledWith("victory");
    expect(beginBattleTransition).not.toHaveBeenCalled();
  });

  it("short-circuits to defeat when the player is already defeated", () => {
    const battleSession = makeSession();
    const state = defaultBattleState();
    state.playerHealth = 0;
    state.deathsDoorActive = false;
    expect(resolveEndTurn(state, 1, battleSession, makeOrch())).toBe(false);
    expect(battleSession.handleVictoryDefeat).toHaveBeenCalledWith("defeat");
  });

  it("dispatches a skipped enemy turn when the enemy is CC-locked", () => {
    const state = defaultBattleState();
    state.enemyCC.stunSkipTurns = 1;
    expect(resolveEndTurn(state, 1, makeSession(), makeOrch())).toBe(false);
    expect(beginBattleTransition).toHaveBeenCalledOnce();
  });
});

describe("resumePendingBattleTransition", () => {
  beforeEach(() => {
    domain = { battleState: defaultBattleState(), pendingBattleTransition: null };
    commitBattleTransition.mockClear();
    clearBattleTransition.mockClear();
    beginBattleTransition.mockClear();
  });

  it("no-ops when the session is stale or nothing is pending", () => {
    const stale = makeSession({ isCurrentBattleSession: () => false });
    domain.pendingBattleTransition = { kind: "continue-end-turn" };
    resumePendingBattleTransition(1, stale, makeOrch());
    expect(clearBattleTransition).not.toHaveBeenCalled();

    domain.pendingBattleTransition = null;
    resumePendingBattleTransition(1, makeSession(), makeOrch());
    expect(clearBattleTransition).not.toHaveBeenCalled();
    expect(commitBattleTransition).not.toHaveBeenCalled();
  });

  it("clears a continue-end-turn marker and re-enters resolveEndTurn", () => {
    const battleSession = makeSession();
    const state = defaultBattleState();
    state.enemyHealth = 0;
    domain.battleState = state;
    domain.pendingBattleTransition = { kind: "continue-end-turn" };

    resumePendingBattleTransition(1, battleSession, makeOrch());

    expect(clearBattleTransition).toHaveBeenCalledOnce();
    expect(battleSession.handleVictoryDefeat).toHaveBeenCalledWith("victory");
  });
});
