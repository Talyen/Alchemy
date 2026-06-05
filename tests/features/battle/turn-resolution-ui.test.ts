import { describe, expect, it, vi } from "vitest";
import {
  executeEnemyPhase,
  resolveHasteSkipTurn,
  resolveNormalEnemyTurn,
} from "@/features/alchemy/run-loop/battle/turn-orchestration";
import { defaultBattleState, endPlayerTurn } from "@/lib/battle";
import type { HandDrawSequenceDeps } from "@/features/alchemy/run-loop/battle/draw-sequence";
import { runHandDrawSequence } from "@/features/alchemy/run-loop/battle/draw-sequence";

vi.mock("@/features/alchemy/run-loop/battle/draw-sequence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/run-loop/battle/draw-sequence")>();
  return { ...actual, runHandDrawSequence: vi.fn(actual.runHandDrawSequence) };
});

vi.mock("@/lib/animation/game-timer", () => ({
  delay: vi.fn(async () => {}),
}));

vi.mock("@/lib/audio", () => ({
  playBattleEvent: vi.fn(),
  playEnemyAttack: vi.fn(),
}));

function makeStore() {
  return {
    showCombatTexts: vi.fn(),
    setSyncedBattleState: vi.fn(),
    setDisplayOverrides: vi.fn(),
    shakePlayer: vi.fn(),
    hurtPlayer: vi.fn(),
    hurtEnemy: vi.fn(),
    shakeEnemy: vi.fn(),
  };
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

describe("resolveHasteSkipTurn", () => {
  it("shows combat texts and runs the draw sequence", async () => {
    const store = makeStore();
    vi.mocked(runHandDrawSequence).mockResolvedValue(true);
    const onDrawComplete = vi.fn();
    const state = defaultBattleState();
    const result = endPlayerTurn({ ...state, playerStatuses: { ...state.playerStatuses, haste: 1 } });

    resolveHasteSkipTurn(
      result,
      state,
      1,
      {
        store,
        drawSequence: makeDrawDeps(),
        onDrawComplete,
        logDrawError: vi.fn(),
        setResolvedAsHasteOrStun: vi.fn(),
        clearHandTransferState: vi.fn(),
        setCardPlayInProgress: vi.fn(),
        runIfSessionActive: (_session, action) => action(),
      },
    );

    await vi.waitFor(() => {
      expect(runHandDrawSequence).toHaveBeenCalled();
      expect(onDrawComplete).toHaveBeenCalled();
    });
    if (result.combatTexts.length > 0) {
      expect(store.showCombatTexts).toHaveBeenCalledWith(result.combatTexts);
    }
  });
});

describe("resolveNormalEnemyTurn", () => {
  it("calls onVictory when the enemy is already dead", () => {
    const store = makeStore();
    const onVictory = vi.fn();
    const state = defaultBattleState();
    const deadResult = {
      ...endPlayerTurn(state),
      state: { ...state, enemyHealth: 0, turnPhase: "enemy" as const },
    };

    resolveNormalEnemyTurn(
      deadResult,
      { state, combatTexts: [] },
      1,
      {
        store,
        executeEnemyPhase: vi.fn(),
        onVictory,
        checkBattleEnd: () => false,
      },
    );

    expect(onVictory).toHaveBeenCalledOnce();
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
      {
        isSessionActive: () => true,
        store,
        drawSequence: makeDrawDeps(),
        runHandDrawSequence: vi.fn(async () => true),
        logDrawError: vi.fn(),
        onPhaseComplete: vi.fn(),
      },
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
      {
        isSessionActive: () => true,
        store,
        drawSequence: makeDrawDeps(),
        runHandDrawSequence: vi.fn(async () => true),
        logDrawError: vi.fn(),
        onPhaseComplete: vi.fn(),
      },
    );

    expect(store.hurtPlayer).not.toHaveBeenCalled();
    expect(store.shakePlayer).toHaveBeenCalledOnce();
  });
});
