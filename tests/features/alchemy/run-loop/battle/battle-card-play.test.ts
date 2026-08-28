import "../../../../helpers/mock-audio";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import type { MouseEvent } from "react";
import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import type { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfer-deps";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";
import { setSyncedBattleState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { makeTestCard } from "../../../../fixtures/battle";
import { playBattleEvent, playUISound } from "@/lib/audio";
import { logError } from "@/lib/error-logger";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";

vi.mock("@/lib/error-logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/error-logger")>()),
  logError: vi.fn(),
}));

vi.mock("@/features/alchemy/run-loop/battle/card-transfer-animations", () => ({
  animateCardActivation: vi.fn(),
}));

vi.mock("@/features/alchemy/run-loop/battle/draw-sequence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/run-loop/battle/draw-sequence")>();
  return {
    ...actual,
    runHandDrawSequence: vi.fn(async (_oldHand, _newState, applyState) => {
      applyState();
      return false;
    }),
  };
});

vi.mock("@/features/alchemy/shared/stores/run-session-write-port", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/alchemy/shared/stores/run-session-write-port")>()),
  awardCardXP: vi.fn(),
}));

import { awardCardXP } from "@/features/alchemy/shared/stores/run-session-write-port";

function makeDeps(overrides: Partial<BattleControllerContext> = {}) {
  const battleSessionRef = { current: 1 };
  const cardPlayInProgressRef = { current: false };
  const scheduleAutoEndTurnMock = vi.fn();
  const ctx = {
    screen: "battle" as const,
    battleSessionRef,
    cardPlayInProgressRef,
    handCardRefs: { current: {} },
    playerPanelRef: { current: null },
    enemyPanelRef: { current: null },
    battleSceneRef: { current: null },
    setHoveredCardId: vi.fn(),
    talents: { talentEffects: {} },
    scheduleAutoEndTurnRef: { current: scheduleAutoEndTurnMock },
    scheduleAutoEndTurn: scheduleAutoEndTurnMock,
    logBattleError: vi.fn(),
    getPresentation: () => useBattlePresentationStore.getState(),
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

  return { ctx, session, transferDeps, awardCardXP: vi.mocked(awardCardXP) };
}

function expectAwardedCard(awardCardXP: Mock, cardId: string) {
  expect(awardCardXP).toHaveBeenCalled();
  expect(awardCardXP.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ id: cardId }));
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
  vi.clearAllMocks();
  resetBattlePresentationAndRun();
});

describe("createBattleCardPlay", () => {
  it("plays a legal card and syncs battle state", async () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 1 }],
      mana: 3,
      enemyHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 1 }, 0);

    expect(readBattle().battleState.hand.length).toBe(0);
    expect(readBattle().battleState.enemyHealth).toBeLessThan(30);
    await vi.waitFor(() => {
      expect(ctx.scheduleAutoEndTurnRef.current).toHaveBeenCalled();
    });
    expectAwardedCard(awardCardXP, "slash");
    expect(playBattleEvent).toHaveBeenCalledWith("enemyHit");
    expect(playUISound).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(1);
  });

  it("rejects plays when mana is insufficient", () => {
    const expensive = makeTestCard({
      id: "meteor",
      cost: 5,
      effects: [{ kind: "damage", damageType: "burn", amount: 20 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...expensive, uid: 2 }],
      mana: 1,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...expensive, uid: 2 }, 0);

    expect(readBattle().battleState).toEqual(state);
    expect(ctx.scheduleAutoEndTurnRef.current).not.toHaveBeenCalled();
    expect(awardCardXP).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledWith("error");
    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(0);
  });

  it("rejects plays when the player is defeated", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 3 }],
      mana: 3,
      playerHealth: 0,
      deathsDoorActive: false,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 3 }, 0);

    expect(readBattle().battleState.enemyHealth).toBe(state.enemyHealth);
    expect(playUISound).toHaveBeenCalledWith("error");
  });

  it("rejects plays while a card transfer is in progress", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 5 }],
      mana: 3,
      enemyHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));
    useBattlePresentationStore.getState().setCardTransferInProgress(true);

    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 5 }, 0);

    expect(readBattle().battleState).toEqual(state);
    expect(awardCardXP).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledWith("error");
  });

  it("rejects plays for cards still animating into the hand", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 6 }],
      mana: 3,
      enemyHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));
    useBattlePresentationStore.getState().setCardTransferInProgress(true);
    useBattlePresentationStore.getState().setHiddenHandCardKeys(() => ["slash-6"]);

    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 6 }, 0);

    expect(readBattle().battleState).toEqual(state);
    expect(awardCardXP).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledWith("error");
  });

  it("plays cards after enemy is defeated during victory grace", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 4 }],
      mana: 3,
      enemyHealth: 0,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 4 }, 0);

    expect(readBattle().battleState.hand.length).toBe(0);
    expect(readBattle().battleState.discard).toHaveLength(1);
    expect(readBattle().battleState.mana).toBe(2);
    expectAwardedCard(awardCardXP, "slash");
    expect(logError).not.toHaveBeenCalled();
  });

  it("autoplays a legal card when the hand DOM ref is missing", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 7 }],
      mana: 3,
      enemyHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleAutoplayCard } = createBattleCardPlay(ctx, session, transferDeps);
    const played = handleAutoplayCard({ ...slash, uid: 7 }, 0);

    expect(played).toBe(true);
    expect(readBattle().battleState.hand.length).toBe(0);
    expectAwardedCard(awardCardXP, "slash");
    expect(playUISound).not.toHaveBeenCalled();
  });

  it("hides newly drawn cards in the same tick as the play commit", () => {
    const draw = makeTestCard({
      id: "quick-study",
      cost: 1,
      effects: [{ kind: "draw-cards", amount: 1 }],
    });
    const incoming = makeTestCard({ id: "slash", uid: 99 });
    const state = makeTestBattleState({
      hand: [{ ...draw, uid: 1 }],
      deck: [incoming],
      mana: 3,
      enemyHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...draw, uid: 1 }, 0);

    expect(transferDeps.getDrawSequenceDeps).toHaveBeenCalledOnce();
    const deps = vi.mocked(transferDeps.getDrawSequenceDeps).mock.results[0]?.value as {
      setHiddenHandCardKeys: Mock;
    };
    expect(deps.setHiddenHandCardKeys).toHaveBeenCalled();
    const hidden = [...deps.setHiddenHandCardKeys.mock.calls[0]![0]([])];
    const drawn = readBattle().battleState.hand.find((card) => card.id === "slash");
    expect(drawn).toBeDefined();
    expect(hidden).toContain(`${drawn!.id}-${drawn!.uid}`);
    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(0);
  });

  it("does not telegraph a player lunge for non-damage cards", () => {
    const guard = makeTestCard({
      id: "guard",
      cost: 1,
      effects: [{ kind: "player-status", status: "block", amount: 5 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...guard, uid: 8 }],
      mana: 3,
      enemyHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...guard, uid: 8 }, 0);

    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(0);
    expect(useBattlePresentationStore.getState().playerCastToken).toBe(1);
  });
});
