// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MouseEvent } from "react";
import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import { getBattleStoreView, resetRunBattleSlice } from "../../helpers/run-domain-store-test";
import { createTestBattleState } from "../../lib/battle/test-state";
import { makeTestCard } from "../../fixtures/battle";

vi.mock("@/lib/audio", () => ({
  playCardSound: vi.fn(),
  playGoldGain: vi.fn(),
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

function makeDeps(overrides: Partial<Parameters<typeof createBattleCardPlay>[0]> = {}) {
  const battleSessionRef = { current: 1 };
  const cardPlayInProgressRef = { current: false };
  return {
    screen: "battle" as const,
    battleState: getBattleStoreView().battleState,
    battleSessionRef,
    cardPlayInProgressRef,
    hiddenHandCardKeys: new Set<string>(),
    cardTransferInProgress: false,
    playerPanelRef: { current: null },
    enemyPanelRef: { current: null },
    battleSceneRef: { current: null },
    setHoveredCardId: vi.fn(),
    talents: { awardCardXP: vi.fn() },
    getDrawSequenceDeps: vi.fn(() => ({})),
    finishDrawSequence: vi.fn(),
    runIfSessionActive: vi.fn((_session, action) => action()),
    scheduleAutoEndTurn: vi.fn(),
    logBattleError: vi.fn(),
    ...overrides,
  };
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
    const slash = makeTestCard({ id: "slash", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] });
    const state = createTestBattleState({
      hand: [{ ...slash, uid: 1 }],
      mana: 3,
      enemyHealth: 30,
    });
    getBattleStoreView().setSyncedBattleState(state);

    const deps = makeDeps();
    const { handleCardClick } = createBattleCardPlay(deps);
    clickCard(handleCardClick, { ...slash, uid: 1 }, 0);

    expect(getBattleStoreView().battleState.hand.length).toBe(0);
    expect(getBattleStoreView().battleState.enemyHealth).toBeLessThan(30);
    expect(deps.scheduleAutoEndTurn).toHaveBeenCalled();
    expect(deps.talents.awardCardXP).toHaveBeenCalledWith(expect.objectContaining({ id: "slash" }));
  });

  it("rejects plays when mana is insufficient", () => {
    const expensive = makeTestCard({ id: "meteor", cost: 5, effects: [{ kind: "damage", damageType: "burn", amount: 20 }] });
    const state = createTestBattleState({
      hand: [{ ...expensive, uid: 2 }],
      mana: 1,
    });
    getBattleStoreView().setSyncedBattleState(state);

    const deps = makeDeps();
    const { handleCardClick } = createBattleCardPlay(deps);
    clickCard(handleCardClick, { ...expensive, uid: 2 }, 0);

    expect(getBattleStoreView().battleState).toEqual(state);
    expect(deps.scheduleAutoEndTurn).not.toHaveBeenCalled();
    expect(deps.talents.awardCardXP).not.toHaveBeenCalled();
  });

  it("rejects plays when the player is defeated", () => {
    const slash = makeTestCard({ id: "slash", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] });
    const state = createTestBattleState({
      hand: [{ ...slash, uid: 3 }],
      mana: 3,
      playerHealth: 0,
      deathsDoorActive: false,
    });
    getBattleStoreView().setSyncedBattleState(state);

    const deps = makeDeps();
    const { handleCardClick } = createBattleCardPlay(deps);
    clickCard(handleCardClick, { ...slash, uid: 3 }, 0);

    expect(getBattleStoreView().battleState.enemyHealth).toBe(state.enemyHealth);
  });

  it("plays a revealed card while another draw transfer is still in progress", () => {
    const slash = makeTestCard({ id: "slash", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] });
    const state = createTestBattleState({
      hand: [{ ...slash, uid: 5 }],
      mana: 3,
      enemyHealth: 30,
    });
    getBattleStoreView().setSyncedBattleState(state);

    const deps = makeDeps({ cardTransferInProgress: true });
    const { handleCardClick } = createBattleCardPlay(deps);
    clickCard(handleCardClick, { ...slash, uid: 5 }, 0);

    expect(getBattleStoreView().battleState.hand.length).toBe(0);
    expect(getBattleStoreView().battleState.enemyHealth).toBeLessThan(30);
    expect(deps.talents.awardCardXP).toHaveBeenCalledWith(expect.objectContaining({ id: "slash" }));
  });

  it("rejects plays for cards still animating into the hand", () => {
    const slash = makeTestCard({ id: "slash", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] });
    const state = createTestBattleState({
      hand: [{ ...slash, uid: 6 }],
      mana: 3,
      enemyHealth: 30,
    });
    getBattleStoreView().setSyncedBattleState(state);

    const deps = makeDeps({
      cardTransferInProgress: true,
      hiddenHandCardKeys: new Set(["slash-6"]),
    });
    const { handleCardClick } = createBattleCardPlay(deps);
    clickCard(handleCardClick, { ...slash, uid: 6 }, 0);

    expect(getBattleStoreView().battleState).toEqual(state);
    expect(deps.talents.awardCardXP).not.toHaveBeenCalled();
  });

  it("plays cards after enemy is defeated during victory grace", () => {
    const slash = makeTestCard({ id: "slash", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] });
    const state = createTestBattleState({
      hand: [{ ...slash, uid: 4 }],
      mana: 3,
      enemyHealth: 0,
    });
    getBattleStoreView().setSyncedBattleState(state);

    const deps = makeDeps();
    const { handleCardClick } = createBattleCardPlay(deps);
    clickCard(handleCardClick, { ...slash, uid: 4 }, 0);

    expect(getBattleStoreView().battleState.hand.length).toBe(0);
    expect(getBattleStoreView().battleState.discard).toHaveLength(1);
    expect(getBattleStoreView().battleState.mana).toBe(2);
    expect(deps.talents.awardCardXP).toHaveBeenCalledWith(expect.objectContaining({ id: "slash" }));
  });
});
