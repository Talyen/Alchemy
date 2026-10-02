import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPlaybackPresentationGate,
  useBattlePresentationGateRef,
  useHandPresentation,
} from "@/features/alchemy/run-loop/battle/presentation/use-hand-presentation";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { makeTestBattleState, makeTestCard } from "../../../../fixtures/battle";
import { resetBattlePresentationAndRun } from "./battle-test-reset";

describe("useBattlePresentationGateRef", () => {
  beforeEach(() => {
    resetBattlePresentationAndRun();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a prior gate snapshot when membership is replaced", () => {
    useBattlePresentationStore.getState().setHiddenHandCardKeys(() => ["slash-1"]);
    const snapshot = readPlaybackPresentationGate();
    useBattlePresentationStore.getState().setHiddenHandCardKeys(() => ["slash-1", "block-2"]);
    expect(snapshot.hiddenHandCardKeys).toEqual(["slash-1"]);
    expect(readPlaybackPresentationGate().hiddenHandCardKeys).toEqual(["block-2", "slash-1"]);
  });

  it("ignores unrelated presentation-store fields", () => {
    const onGateChange = vi.fn();
    const onGateChangeRef = { current: onGateChange };
    renderHook(() => useBattlePresentationGateRef(onGateChangeRef));

    act(() => {
      useBattlePresentationStore.setState({ enemyShaking: true });
    });

    expect(onGateChange).not.toHaveBeenCalled();
  });

  it("does not notify when membership is unchanged", () => {
    useBattlePresentationStore.getState().setHiddenHandCardKeys(() => ["slash-1"]);
    const onGateChange = vi.fn();
    const onGateChangeRef = { current: onGateChange };
    renderHook(() => useBattlePresentationGateRef(onGateChangeRef));

    act(() => {
      useBattlePresentationStore.getState().setHiddenHandCardKeys(() => ["slash-1"]);
    });

    expect(onGateChange).not.toHaveBeenCalled();
  });

  it("notifies when transfer progress flips", () => {
    const onGateChange = vi.fn();
    const onGateChangeRef = { current: onGateChange };
    renderHook(() => useBattlePresentationGateRef(onGateChangeRef));

    act(() => {
      useBattlePresentationStore.setState({ cardTransferInProgress: true });
    });

    expect(onGateChange).toHaveBeenCalledOnce();
  });

  it("notifies when hidden-hand membership changes", () => {
    useBattlePresentationStore.getState().setHiddenHandCardKeys(() => ["slash-1"]);
    const onGateChange = vi.fn();
    const onGateChangeRef = { current: onGateChange };
    renderHook(() => useBattlePresentationGateRef(onGateChangeRef));

    act(() => {
      useBattlePresentationStore.getState().setHiddenHandCardKeys(() => []);
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
    const { result } = renderHook(() => useHandPresentation(state));
    act(() => {
      useBattlePresentationStore.getState().setHiddenHandCardKeys(() => ["slash-1"]);
      useBattlePresentationStore.getState().setCardTransferInProgress(true);
    });
    expect([...result.current.playableHandCardKeys]).toEqual(["slash-1", "block-2"]);
    expect([...result.current.interactiveHandCardKeys]).toEqual(["block-2"]);
    expect(result.current.animationInProgress).toBe(true);
    act(() => useBattlePresentationStore.getState().resetHandTransferUi());
    expect([...result.current.interactiveHandCardKeys]).toEqual(["slash-1", "block-2"]);
    expect(result.current.animationInProgress).toBe(false);
  });

  it("rechecks engine legality when a cost trigger changes without changing the hand or mana", () => {
    const state = makeTestBattleState({ hand: [makeTestCard({ id: "slash", uid: 1 })], mana: 0 });
    const { result, rerender } = renderHook((battle) => useHandPresentation(battle), { initialProps: state });
    expect(result.current.playableHandCardKeys.size).toBe(0);
    rerender({ ...state, flags: { ...state.flags, nextCardCostReduction: 1 } });
    expect([...result.current.playableHandCardKeys]).toEqual(["slash-1"]);
    rerender(state);
    expect(result.current.interactiveHandCardKeys.size).toBe(0);
  });
});
