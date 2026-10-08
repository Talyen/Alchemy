import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { createBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPlaybackPresentationGate,
  useBattlePresentationGateRef,
  useHandPresentation,
} from "@/features/alchemy/run-loop/battle/presentation/use-hand-presentation";
import { battlePresentation } from "@/app/battle-presentation";
import { makeTestBattleState, makeTestCard } from "../../../../fixtures/battle";
import { resetBattlePresentationAndRun } from "./battle-test-reset";

describe("useBattlePresentationGateRef", () => {
  beforeEach(() => {
    resetBattlePresentationAndRun();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("isolates playback gates and switches subscriptions when the supplied store changes", async () => {
    const firstSession = createGameSession();
    const secondSession = createGameSession();
    const first = createBattlePresentationStore(firstSession);
    const second = createBattlePresentationStore(secondSession);
    const wake = vi.fn();
    const wakeRef = { current: wake };
    const { result, rerender, unmount } = renderHook((store) => useBattlePresentationGateRef(store, wakeRef), {
      initialProps: first,
    });
    try {
      act(() => second.getState().setCardTransferInProgress(true));
      expect(result.current.current.cardTransferInProgress).toBe(false);
      expect(wake).not.toHaveBeenCalled();
      act(() => first.getState().setHiddenHandCardKeys(() => ["first-card"]));
      expect(result.current.current.hiddenHandCardKeys).toEqual(["first-card"]);
      expect(wake).toHaveBeenCalledOnce();
      rerender(second);
      expect(result.current.current.cardTransferInProgress).toBe(true);
      expect(result.current.current.hiddenHandCardKeys).toEqual([]);
      wake.mockClear();
      act(() => first.getState().resetPresentation());
      expect(wake).not.toHaveBeenCalled();
      act(() => second.getState().resetHandTransferUi());
      expect(result.current.current.cardTransferInProgress).toBe(false);
      expect(wake).toHaveBeenCalledOnce();
      unmount();
      wake.mockClear();
      second.getState().setCardTransferInProgress(true);
      expect(wake).not.toHaveBeenCalled();
    } finally {
      unmount();
      await firstSession.dispose();
      await secondSession.dispose();
    }
  });

  it("keeps a prior gate snapshot when membership is replaced", () => {
    battlePresentation.getState().setHiddenHandCardKeys(() => ["slash-1"]);
    const snapshot = readPlaybackPresentationGate(battlePresentation);
    battlePresentation.getState().setHiddenHandCardKeys(() => ["slash-1", "block-2"]);
    expect(snapshot.hiddenHandCardKeys).toEqual(["slash-1"]);
    expect(readPlaybackPresentationGate(battlePresentation).hiddenHandCardKeys).toEqual(["block-2", "slash-1"]);
  });

  it("ignores unrelated presentation-store fields", () => {
    const onGateChange = vi.fn();
    const onGateChangeRef = { current: onGateChange };
    renderHook(() => useBattlePresentationGateRef(battlePresentation, onGateChangeRef));

    act(() => {
      battlePresentation.setState({ enemyShaking: true });
    });

    expect(onGateChange).not.toHaveBeenCalled();
  });

  it("does not notify when membership is unchanged", () => {
    battlePresentation.getState().setHiddenHandCardKeys(() => ["slash-1"]);
    const onGateChange = vi.fn();
    const onGateChangeRef = { current: onGateChange };
    renderHook(() => useBattlePresentationGateRef(battlePresentation, onGateChangeRef));

    act(() => {
      battlePresentation.getState().setHiddenHandCardKeys(() => ["slash-1"]);
    });

    expect(onGateChange).not.toHaveBeenCalled();
  });

  it("notifies when transfer progress flips", () => {
    const onGateChange = vi.fn();
    const onGateChangeRef = { current: onGateChange };
    renderHook(() => useBattlePresentationGateRef(battlePresentation, onGateChangeRef));

    act(() => {
      battlePresentation.setState({ cardTransferInProgress: true });
    });

    expect(onGateChange).toHaveBeenCalledOnce();
  });

  it("notifies when hidden-hand membership changes", () => {
    battlePresentation.getState().setHiddenHandCardKeys(() => ["slash-1"]);
    const onGateChange = vi.fn();
    const onGateChangeRef = { current: onGateChange };
    renderHook(() => useBattlePresentationGateRef(battlePresentation, onGateChangeRef));

    act(() => {
      battlePresentation.getState().setHiddenHandCardKeys(() => []);
    });

    expect(onGateChange).toHaveBeenCalledOnce();
  });
});

describe("useHandPresentation", () => {
  beforeEach(resetBattlePresentationAndRun);

  it("keeps visual legality while a drawn card is hidden and reveals its interaction on completion", () => {
    const state = makeTestBattleState({
      hand: [makeTestCard({ id: "slash", uid: 1 }), makeTestCard({ id: "block", uid: 2 })],
    });
    const { result } = renderHook(() => useHandPresentation(battlePresentation, state));
    act(() => {
      battlePresentation.getState().setHiddenHandCardKeys(() => ["slash-1"]);
      battlePresentation.getState().setCardTransferInProgress(true);
    });
    expect([...result.current.playableHandCardKeys]).toEqual(["slash-1", "block-2"]);
    expect([...result.current.interactiveHandCardKeys]).toEqual(["block-2"]);
    expect(result.current.animationInProgress).toBe(true);
    act(() => battlePresentation.getState().resetHandTransferUi());
    expect([...result.current.interactiveHandCardKeys]).toEqual(["slash-1", "block-2"]);
    expect(result.current.animationInProgress).toBe(false);
  });

  it("rechecks engine legality when a cost trigger changes without changing the hand or mana", () => {
    const state = makeTestBattleState({ hand: [makeTestCard({ id: "slash", uid: 1 })], mana: 0 });
    const { result, rerender } = renderHook((battle) => useHandPresentation(battlePresentation, battle), {
      initialProps: state,
    });
    expect(result.current.playableHandCardKeys.size).toBe(0);
    rerender({ ...state, flags: { ...state.flags, nextCardCostReduction: 1 } });
    expect([...result.current.playableHandCardKeys]).toEqual(["slash-1"]);
    rerender(state);
    expect(result.current.interactiveHandCardKeys.size).toBe(0);
  });
});
