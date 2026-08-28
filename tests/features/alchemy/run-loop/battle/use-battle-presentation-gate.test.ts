import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPlaybackPresentationGate,
  useBattlePresentationGateRef,
} from "@/features/alchemy/run-loop/battle/use-battle-presentation-gate";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
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
