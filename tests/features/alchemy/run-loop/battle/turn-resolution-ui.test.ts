import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  executeEnemyPhase,
  resolveHasteSkipTurn,
  resolveNormalEnemyTurn,
  resumePendingBattleTransition,
  type TurnOrchestration,
} from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { defaultBattleState, endPlayerTurn } from "@/lib/battle";
import { runHandDrawSequence, type HandDrawSequenceDeps } from "@/features/alchemy/run-loop/battle/draw-sequence";
import type { getBattleSessionStore } from "@/features/alchemy/run-loop/battle/battle-session";

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

let activeStore: ReturnType<typeof makeStore>;

vi.mock("@/features/alchemy/run-loop/battle/battle-session", () => ({
  getBattleSessionStore: () => activeStore,
}));

function makeStore(): ReturnType<typeof getBattleSessionStore> {
  return {
    showCombatTexts: vi.fn(),
    setSyncedBattleState: vi.fn(),
    setDisplayOverrides: vi.fn(),
    shakePlayer: vi.fn(),
    hurtPlayer: vi.fn(),
    hurtEnemy: vi.fn(),
    shakeEnemy: vi.fn(),
    shakeCompanion: vi.fn(),
    battleState: defaultBattleState(),
    pendingBattleTransition: null,
    cardGhosts: [],
    floatingCombatTexts: [],
    enemyShaking: false,
    playerShaking: false,
    companionShaking: false,
    playerHurtFlashToken: 0,
    deathsDoorActive: false,
    previousPlayerHealth: 30,
    previousEnemyHealth: 0,
    manaPanelMode: "normal" as const,
    maxManaFlashActive: false,
    menuOpen: false,
    handDisabled: false,
    handDiscarded: false,
    drawPending: false,
    resolvePending: false,
    autoEndTurnTimerId: null,
    damageReductionFloor: null,
    cardsThatCannotBeAutoEndTurnedOn: [],
    transferInProgress: false,
    hiddenHandCardKeys: new Set(),
    pendingDraw: null,
    pendingTransferAnimations: [],
    pendingResolveAnimations: [],
    battleSessionHistory: [],
    hudOverride: null,
    displayOverrides: {},
    initializeActiveBattle: vi.fn(),
    setBattleState: vi.fn(),
    setDeathDoor: vi.fn(),
    setMenuOpen: vi.fn(),
    setHandDisabled: vi.fn(),
    setHandDiscarded: vi.fn(),
    setDrawPending: vi.fn(),
    setResolvePending: vi.fn(),
    setAutoEndTurnTimerId: vi.fn(),
    setDamageReductionFloor: vi.fn(),
    setCardsThatCannotBeAutoEndTurnedOn: vi.fn(),
    setTransferInProgress: vi.fn(),
    setHiddenHandCardKeys: vi.fn(),
    setPendingDraw: vi.fn(),
    setHudOverride: vi.fn(),
    setBattleSessionHistory: vi.fn(),
    pushCombatTexts: vi.fn(),
    setMaxManaFlash: vi.fn(),
    resetDisplayOverrides: vi.fn(),
    getAutoEndTurnCandidate: vi.fn(() => null),
  } as unknown as ReturnType<typeof getBattleSessionStore>;
}

function makeDrawDeps(): HandDrawSequenceDeps {
  return {
    isSessionActive: () => true,
    animateDrawnHand: vi.fn(async () => {}),
    setTransferInProgress: vi.fn(),
    setHiddenHandCardKeys: vi.fn(),
    runIfSessionActive: (_session, action) => action(),
  };
}

function makeOrch(): TurnOrchestration {
  return {
    isCurrentBattleSession: () => true,
    runIfSessionActive: <T>(_session: number, action: () => T) => action(),
    checkBattleEnd: vi.fn(() => false),
    handleVictoryDefeat: vi.fn(),
    getDrawSequenceDeps: () => makeDrawDeps(),
    logBattleError: vi.fn(),
    resetHandTransferUi: vi.fn(),
    scheduleCompanionFollowUp: vi.fn(),
  };
}

beforeEach(() => {
  activeStore = makeStore();
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

    resolveHasteSkipTurn(result, state, 1, orch);

    await vi.waitFor(() => {
      expect(orch.scheduleCompanionFollowUp).toHaveBeenCalled();
    });
    if (result.combatTexts.length > 0) {
      expect(activeStore.showCombatTexts).toHaveBeenCalledWith(result.combatTexts);
    }
  });
});

describe("resolveNormalEnemyTurn", () => {
  it("commits a resumable continuation before presentation delays", () => {
    const state = defaultBattleState();
    const result = endPlayerTurn(state);
    if (result.kind === "haste") throw new Error("Expected an enemy-turn resolution");
    const orch = makeOrch();

    resolveNormalEnemyTurn(result, state, [], 1, orch);

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

    resolveNormalEnemyTurn(deadResult, state, [], 1, orch);

    expect(orch.handleVictoryDefeat).toHaveBeenCalledWith("victory");
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
      makeOrch(),
    );

    expect(activeStore.shakePlayer).toHaveBeenCalledOnce();
    expect(activeStore.hurtPlayer).toHaveBeenCalledOnce();
    expect(activeStore.showCombatTexts).toHaveBeenCalled();
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
      makeOrch(),
    );

    expect(activeStore.hurtPlayer).not.toHaveBeenCalled();
    expect(activeStore.shakePlayer).toHaveBeenCalledOnce();
  });

  it("commits result state via the draw sequence applyState callback", async () => {
    const current = defaultBattleState();
    const result = { ...current, turn: 2, hand: current.hand };
    const orch = makeOrch();

    await executeEnemyPhase(result, current, [], 1, false, false, orch);

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
    activeStore.pendingBattleTransition = {
      kind: "enemy-turn",
      resultState,
      playerTurnSkipped: false,
    };
    const orch = makeOrch();

    resumePendingBattleTransition(1, orch);

    expect(commitBattleTransition).toHaveBeenCalledWith(resultState, null);
    expect(orch.scheduleCompanionFollowUp).toHaveBeenCalledWith(resultState, 1);
  });

  it("recovers legacy enemy-phase markers into a playable player turn", () => {
    const enemyPhase = { ...defaultBattleState(), turnPhase: "enemy" as const, hand: [] };
    activeStore.battleState = enemyPhase;
    activeStore.pendingBattleTransition = { kind: "legacy-enemy-turn" };
    const orch = makeOrch();

    resumePendingBattleTransition(1, orch);

    expect(commitBattleTransition).toHaveBeenCalledOnce();
    const [recovered, continuation] = vi.mocked(commitBattleTransition).mock.calls[0]!;
    expect(continuation).toBeNull();
    expect(recovered.turnPhase).toBe("player");
    expect(orch.checkBattleEnd).toHaveBeenCalledWith(recovered, 1);
  });
});
