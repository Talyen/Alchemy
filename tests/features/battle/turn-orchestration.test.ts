import { describe, expect, it, vi } from "vitest";
import { resolveEndTurn } from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { getBattleSessionStore } from "@/features/alchemy/run-loop/battle/battle-session";
import { defaultBattleState } from "@/lib/battle";

function makeDeps() {
  const store = {
    battleState: defaultBattleState(),
    setSyncedBattleState: vi.fn(),
    showCombatTexts: vi.fn(),
    shakeEnemy: vi.fn(),
    shakePlayer: vi.fn(),
    hurtEnemy: vi.fn(),
    hurtPlayer: vi.fn(),
    setDisplayOverrides: vi.fn(),
    shakeCompanion: vi.fn(),
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

  const getStore = vi.fn(() => store);

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
