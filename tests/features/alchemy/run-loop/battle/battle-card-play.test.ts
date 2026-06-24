// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MouseEvent } from "react";
import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import type { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfer-deps";
import { getBattleStoreView, resetRunBattleSlice } from "../../../../helpers/run-domain-store-test";
import { createTestBattleState } from "../../../../lib/battle/test-state";
import { makeTestCard } from "../../../../fixtures/battle";
import { playUISound } from "@/lib/audio";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";

vi.mock("@/lib/audio", () => ({
  playCardSound: vi.fn(),
  playGoldGain: vi.fn(),
  playUISound: vi.fn(),
}));

vi.mock("@/features/alchemy/run-loop/battle/card-transfer-animations", () => ({
  animateCardActivation: vi.fn(),
}));

vi.mock("@/features/alchemy/run-loop/battle/draw-sequence", () => ({
  runHandDrawSequence: vi.fn(async (_oldHand, _newState, applyState) => {
    applyState();
    return false;
  }),
}));

function makeDeps(overrides: Partial<BattleControllerContext> = {}) {
  const battleSessionRef = { current: 1 };
  const cardPlayInProgressRef = { current: false };
  const scheduleAutoEndTurnMock = vi.fn();
  const ctx = {
    screen: "battle" as const,
    battleSessionRef,
    cardPlayInProgressRef,
    playerPanelRef: { current: null },
    enemyPanelRef: { current: null },
    battleSceneRef: { current: null },
    setHoveredCardId: vi.fn(),
    talents: { awardCardXP: vi.fn() },
    scheduleAutoEndTurnRef: { current: scheduleAutoEndTurnMock },
    scheduleAutoEndTurn: scheduleAutoEndTurnMock,
    logBattleError: vi.fn(),
    ...overrides,
  } as unknown as BattleControllerContext;

  const session = {
    runIfSessionActive: vi.fn((_session, action) => action()),
    finishDrawSequence: vi.fn((_sessionNum, _state, cb) => cb()),
    checkBattleEnd: vi.fn(),
  } as unknown as ReturnType<typeof createBattleSession>;

  const transferDeps = {
    getDrawSequenceDeps: vi.fn(() => ({
      isSessionActive: () => true,
      animateDrawnHand: vi.fn(),
      setTransferInProgress: vi.fn(),
      setHiddenHandCardKeys: vi.fn(),
      runIfSessionActive: vi.fn(),
    })),
  } as unknown as ReturnType<typeof createBattleTransferDeps>;

  return { ctx, session, transferDeps };
}

function clickCard(
  handleCardClick: ReturnType<typeof createBattleCardPlay>["handleCardClick"],
  card: ReturnType<typeof makeTestCard> & { uid: number },
  index: number,
) {
  const button = document.createElement("button");
  Object.defineProperty(button, "getBoundingClientRect", {
    value: () => ({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      top: 0,
      left: 0,
      right: 10,
      bottom: 10,
      toJSON: () => ({}),
    }),
  });
  handleCardClick(card, index, { currentTarget: button } as unknown as MouseEvent<HTMLButtonElement>);
}

beforeEach(() => {
  resetRunBattleSlice();
});

describe("createBattleCardPlay", () => {
  it("plays a legal card and syncs battle state", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = createTestBattleState({
      hand: [{ ...slash, uid: 1 }],
      mana: 3,
      enemyHealth: 30,
    });
    getBattleStoreView().setSyncedBattleState(state);

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 1 }, 0);

    expect(getBattleStoreView().battleState.hand.length).toBe(0);
    expect(getBattleStoreView().battleState.enemyHealth).toBeLessThan(30);
    expect(ctx.scheduleAutoEndTurnRef.current).toHaveBeenCalled();
    expect(ctx.talents.awardCardXP).toHaveBeenCalledWith(expect.objectContaining({ id: "slash" }));
    expect(playUISound).not.toHaveBeenCalled();
  });

  it("rejects plays when mana is insufficient", () => {
    const expensive = makeTestCard({
      id: "meteor",
      cost: 5,
      effects: [{ kind: "damage", damageType: "burn", amount: 20 }],
    });
    const state = createTestBattleState({
      hand: [{ ...expensive, uid: 2 }],
      mana: 1,
    });
    getBattleStoreView().setSyncedBattleState(state);

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...expensive, uid: 2 }, 0);

    expect(getBattleStoreView().battleState).toEqual(state);
    expect(ctx.scheduleAutoEndTurnRef.current).not.toHaveBeenCalled();
    expect(ctx.talents.awardCardXP).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledWith("error");
  });

  it("rejects plays when the player is defeated", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = createTestBattleState({
      hand: [{ ...slash, uid: 3 }],
      mana: 3,
      playerHealth: 0,
      deathsDoorActive: false,
    });
    getBattleStoreView().setSyncedBattleState(state);

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 3 }, 0);

    expect(getBattleStoreView().battleState.enemyHealth).toBe(state.enemyHealth);
    expect(playUISound).toHaveBeenCalledWith("error");
  });

  it("plays a revealed card while another draw transfer is still in progress", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = createTestBattleState({
      hand: [{ ...slash, uid: 5 }],
      mana: 3,
      enemyHealth: 30,
    });
    getBattleStoreView().setSyncedBattleState(state);

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 5 }, 0);

    expect(getBattleStoreView().battleState.hand.length).toBe(0);
    expect(getBattleStoreView().battleState.enemyHealth).toBeLessThan(30);
    expect(ctx.talents.awardCardXP).toHaveBeenCalledWith(expect.objectContaining({ id: "slash" }));
  });

  it("rejects plays for cards still animating into the hand", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = createTestBattleState({
      hand: [{ ...slash, uid: 6 }],
      mana: 3,
      enemyHealth: 30,
    });
    getBattleStoreView().setSyncedBattleState(state);
    useBattlePresentationStore.getState().setCardTransferInProgress(true);
    useBattlePresentationStore.getState().setHiddenHandCardKeys(new Set(["slash-6"]));

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 6 }, 0);

    expect(getBattleStoreView().battleState).toEqual(state);
    expect(ctx.talents.awardCardXP).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledWith("error");
  });

  it("plays cards after enemy is defeated during victory grace", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = createTestBattleState({
      hand: [{ ...slash, uid: 4 }],
      mana: 3,
      enemyHealth: 0,
    });
    getBattleStoreView().setSyncedBattleState(state);

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 4 }, 0);

    expect(getBattleStoreView().battleState.hand.length).toBe(0);
    expect(getBattleStoreView().battleState.discard).toHaveLength(1);
    expect(getBattleStoreView().battleState.mana).toBe(2);
    expect(ctx.talents.awardCardXP).toHaveBeenCalledWith(expect.objectContaining({ id: "slash" }));
  });
});
