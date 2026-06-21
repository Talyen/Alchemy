import { describe, expect, it, vi } from "vitest";
import {
  executeEnemyPhase,
  resolveHasteSkipTurn,
  resolveNormalEnemyTurn,
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
  it("calls handleVictoryDefeat when the enemy is already dead", () => {
    const store = makeStore();
    const state = defaultBattleState();
    const deadResult = {
      ...endPlayerTurn(state),
      kind: "standard" as const,
      state: { ...state, enemyHealth: 0, turnPhase: "enemy" as const },
    };
    const deps = makeTurnDeps(store);

    resolveNormalEnemyTurn(deadResult, state, [], 1, deps);

    expect(deps.handleVictoryDefeat).toHaveBeenCalledWith("victory");
    expect(store.setSyncedBattleState).toHaveBeenCalled();
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
