import { describe, expect, it, vi } from "vitest";
import {
  executeEnemyPhase,
  resolveHasteSkipTurn,
  resolveNormalEnemyTurn,
  resumePendingBattleTransition,
} from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { defaultBattleState, endPlayerTurn } from "@/lib/battle";
import type { HandDrawSequenceDeps } from "@/features/alchemy/run-loop/battle/draw-sequence";
import type { getBattleSessionStore } from "@/features/alchemy/run-loop/battle/battle-session";

vi.mock("@/features/alchemy/run-loop/battle/draw-sequence");

vi.mock("@/lib/animation/game-timer", () => ({
  delay: vi.fn(async () => {}),
}));

vi.mock("@/lib/audio", () => ({
  playBattleEvent: vi.fn(),
  playEnemyAttack: vi.fn(),
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

function makeTurnDeps(store: ReturnType<typeof makeStore>) {
  return {
    getStore: () => store,
    setBattleState: vi.fn(),
    beginBattleTransition: vi.fn(),
    commitBattleTransition: vi.fn(),
    clearBattleTransition: vi.fn(),
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

describe("resolveHasteSkipTurn", () => {
  it("shows combat texts and runs the draw sequence", async () => {
    const store = makeStore();
    const state = defaultBattleState();
    const result = endPlayerTurn({ ...state, playerStatuses: { ...state.playerStatuses, haste: 1 } });
    const deps = makeTurnDeps(store);

    resolveHasteSkipTurn(result, state, 1, deps);

    await vi.waitFor(() => {
      expect(deps.scheduleCompanionFollowUp).toHaveBeenCalled();
    });
    if (result.combatTexts.length > 0) {
      expect(store.showCombatTexts).toHaveBeenCalledWith(result.combatTexts);
    }
  });
});

describe("resolveNormalEnemyTurn", () => {
  it("commits a resumable continuation before presentation delays", () => {
    const store = makeStore();
    const state = defaultBattleState();
    const result = endPlayerTurn(state);
    if (result.kind === "haste") throw new Error("Expected an enemy-turn resolution");
    const deps = makeTurnDeps(store);

    resolveNormalEnemyTurn(result, state, [], 1, deps);

    expect(deps.beginBattleTransition).toHaveBeenCalledWith(
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
    const store = makeStore();
    const state = defaultBattleState();
    const result = endPlayerTurn(state);
    expect(result.kind).not.toBe("haste");
    if (result.kind === "haste") throw new Error("Expected an enemy-turn resolution");
    const deadResult = {
      ...result,
      kind: "standard" as const,
      state: { ...state, enemyHealth: 0, turnPhase: "enemy" as const },
    };
    const deps = makeTurnDeps(store);

    resolveNormalEnemyTurn(deadResult, state, [], 1, deps);

    expect(deps.handleVictoryDefeat).toHaveBeenCalledWith("victory");
    expect(deps.commitBattleTransition).toHaveBeenCalled();
  });
});

describe("executeEnemyPhase", () => {
  it("shakes the player when enemy damage texts are present", async () => {
    const store = makeStore();
    const current = defaultBattleState();
    const result = { ...current, playerHealth: 5 };

    await executeEnemyPhase(
      result,
      current,
      [{ target: "player", kind: "damage", stat: "health", amount: 4 }],
      1,
      false,
      true,
      makeTurnDeps(store),
    );

    expect(store.shakePlayer).toHaveBeenCalledOnce();
    expect(store.hurtPlayer).toHaveBeenCalledOnce();
    expect(store.showCombatTexts).toHaveBeenCalled();
  });

  it("does not hurt the player when only block absorb damage is present", async () => {
    const store = makeStore();
    const current = defaultBattleState();
    const result = { ...current, playerHealth: 5 };

    await executeEnemyPhase(
      result,
      current,
      [{ target: "player", kind: "damage", stat: "block", amount: 4 }],
      1,
      false,
      true,
      makeTurnDeps(store),
    );

    expect(store.hurtPlayer).not.toHaveBeenCalled();
    expect(store.shakePlayer).toHaveBeenCalledOnce();
  });
});

describe("resumePendingBattleTransition", () => {
  it("commits the computed result without replaying animation delays", () => {
    const store = makeStore();
    const resultState = { ...defaultBattleState(), turn: 2, playerHealth: 18 };
    store.pendingBattleTransition = {
      kind: "enemy-turn",
      resultState,
      playerTurnSkipped: false,
    };
    const deps = makeTurnDeps(store);

    resumePendingBattleTransition(1, deps);

    expect(deps.commitBattleTransition).toHaveBeenCalledWith(resultState, null);
    expect(deps.scheduleCompanionFollowUp).toHaveBeenCalledWith(resultState, 1);
  });
});
