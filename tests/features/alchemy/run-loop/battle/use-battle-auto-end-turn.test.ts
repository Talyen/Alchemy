import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBattleAutoEndTurn } from "@/features/alchemy/run-loop/battle/use-battle-auto-end-turn";
import { useBattlePresentationGateRef } from "@/features/alchemy/run-loop/battle/use-battle-presentation-gate";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import type { BattleState } from "@/lib/battle";
import { AUTO_END_TURN_DELAY } from "@/lib/game-constants";
import { ANIMATION_DISABLED_DURATION } from "@/lib/animation/animation-prefs";
import * as animationPrefs from "@/lib/animation/animation-prefs";
import { makeEmptyHandBattle, makeOpenBattle, makeUnplayableBattle } from "./open-battle-fixture";

const baseOptions = {
  autoEndTurn: true,
  screen: "battle" as const,
  hasActiveBattle: true,
};

function useAutoEndTurnUnderTest(
  options: Omit<Parameters<typeof useBattleAutoEndTurn>[0], "presentationGateRef" | "scheduleAutoEndTurnRef">,
) {
  const scheduleAutoEndTurnRef = useRef<(state?: BattleState) => void>(() => {});
  const presentationGateRef = useBattlePresentationGateRef(scheduleAutoEndTurnRef);
  return useBattleAutoEndTurn({
    ...options,
    presentationGateRef,
    scheduleAutoEndTurnRef,
  });
}

describe("useBattleAutoEndTurn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetBattlePresentationAndRun();
    useUiStore.getState().setCardInspection(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cancels an existing timer during inspection and resumes after closing", () => {
    const onEndTurn = vi.fn();
    renderHook(() =>
      useAutoEndTurnUnderTest({ ...baseOptions, battleState: makeEmptyHandBattle().battleState, onEndTurn }),
    );
    act(() => useUiStore.getState().setCardInspection("deck"));
    act(() => vi.advanceTimersByTime(AUTO_END_TURN_DELAY * 2));
    expect(onEndTurn).not.toHaveBeenCalled();
    act(() => useUiStore.getState().setCardInspection(null));
    act(() => vi.advanceTimersByTime(AUTO_END_TURN_DELAY));
    expect(onEndTurn).toHaveBeenCalledOnce();
  });

  it("schedules end turn when no card is playable", () => {
    const onEndTurn = vi.fn();
    renderHook(() =>
      useAutoEndTurnUnderTest({
        ...baseOptions,
        battleState: makeUnplayableBattle().battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY);
    });

    expect(onEndTurn).toHaveBeenCalledOnce();
  });

  it("clearAutoEndTurn cancels a pending auto-end timer", () => {
    const onEndTurn = vi.fn();
    const { result } = renderHook(() =>
      useAutoEndTurnUnderTest({
        ...baseOptions,
        battleState: makeUnplayableBattle().battleState,
        onEndTurn,
      }),
    );

    act(() => {
      result.current.clearAutoEndTurn();
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });

    expect(onEndTurn).not.toHaveBeenCalled();
  });

  it("scheduleAutoEndTurn fires after an unplayable player turn resumes", () => {
    const onEndTurn = vi.fn();
    const battleState = makeEmptyHandBattle().battleState;
    const { result } = renderHook(() =>
      useAutoEndTurnUnderTest({
        ...baseOptions,
        battleState,
        onEndTurn,
      }),
    );

    act(() => {
      result.current.clearAutoEndTurn();
      result.current.scheduleAutoEndTurn(battleState);
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY);
    });

    expect(onEndTurn).toHaveBeenCalledOnce();
  });

  it("schedules end turn after a hand transfer completes", () => {
    const onEndTurn = vi.fn();
    useBattlePresentationStore.setState({ cardTransferInProgress: true });
    renderHook(() =>
      useAutoEndTurnUnderTest({
        ...baseOptions,
        battleState: makeEmptyHandBattle().battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });
    expect(onEndTurn).not.toHaveBeenCalled();

    act(() => {
      useBattlePresentationStore.setState({ cardTransferInProgress: false });
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY);
    });

    expect(onEndTurn).toHaveBeenCalledOnce();
  });

  it("reschedules when hidden-hand membership is replaced", () => {
    const onEndTurn = vi.fn();
    useBattlePresentationStore.getState().setHiddenHandCardKeys(() => ["meteor-1"]);
    renderHook(() =>
      useAutoEndTurnUnderTest({
        ...baseOptions,
        battleState: makeUnplayableBattle().battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });
    expect(onEndTurn).not.toHaveBeenCalled();

    act(() => {
      useBattlePresentationStore.getState().setHiddenHandCardKeys(() => []);
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY);
    });

    expect(onEndTurn).toHaveBeenCalledOnce();
  });

  it("schedules end turn when auto-end-turn is toggled on mid-turn", () => {
    const onEndTurn = vi.fn();
    const { rerender } = renderHook(
      ({ autoEndTurn }: { autoEndTurn: boolean }) =>
        useAutoEndTurnUnderTest({
          ...baseOptions,
          autoEndTurn,
          battleState: makeEmptyHandBattle().battleState,
          onEndTurn,
        }),
      { initialProps: { autoEndTurn: false } },
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });
    expect(onEndTurn).not.toHaveBeenCalled();

    rerender({ autoEndTurn: true });
    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY);
    });

    expect(onEndTurn).toHaveBeenCalledOnce();
  });

  it("schedules end turn despite orphaned hidden-hand keys", () => {
    const onEndTurn = vi.fn();
    useBattlePresentationStore.setState({ hiddenHandCardKeys: ["slash-1"] });
    renderHook(() =>
      useAutoEndTurnUnderTest({
        ...baseOptions,
        battleState: makeEmptyHandBattle().battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY);
    });

    expect(onEndTurn).toHaveBeenCalledOnce();
  });

  it("collapses the auto-end delay when animations are disabled", () => {
    vi.spyOn(animationPrefs, "isAnimationDisabled").mockReturnValue(true);
    const onEndTurn = vi.fn();
    renderHook(() =>
      useAutoEndTurnUnderTest({
        ...baseOptions,
        battleState: makeUnplayableBattle().battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(ANIMATION_DISABLED_DURATION);
    });

    expect(onEndTurn).toHaveBeenCalledOnce();
  });

  it("does not reschedule from a battleState rerender without an explicit schedule call", () => {
    const onEndTurn = vi.fn();
    const { rerender, result } = renderHook(
      ({ battleState }: { battleState: BattleState }) =>
        useAutoEndTurnUnderTest({
          ...baseOptions,
          battleState,
          onEndTurn,
        }),
      { initialProps: { battleState: makeOpenBattle().battleState } },
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });
    expect(onEndTurn).not.toHaveBeenCalled();

    rerender({ battleState: makeEmptyHandBattle().battleState });
    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });
    expect(onEndTurn).not.toHaveBeenCalled();

    act(() => {
      result.current.scheduleAutoEndTurn(makeEmptyHandBattle().battleState);
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY);
    });
    expect(onEndTurn).toHaveBeenCalledOnce();
  });

  it.each([false, true])("restarts a full countdown after closing the menu (initially open: %s)", (initiallyOpen) => {
    const onEndTurn = vi.fn();
    const battleState = makeEmptyHandBattle().battleState;
    const { rerender } = renderHook(
      ({ gameMenuOpen }) => useAutoEndTurnUnderTest({ ...baseOptions, battleState, gameMenuOpen, onEndTurn }),
      { initialProps: { gameMenuOpen: initiallyOpen } },
    );
    if (!initiallyOpen) {
      act(() => {
        vi.advanceTimersByTime(AUTO_END_TURN_DELAY / 2);
      });
      rerender({ gameMenuOpen: true });
    }
    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY * 2);
    });
    expect(onEndTurn).not.toHaveBeenCalled();

    rerender({ gameMenuOpen: false });
    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY / 2);
    });
    rerender({ gameMenuOpen: true });
    rerender({ gameMenuOpen: false });
    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY - 1);
    });
    expect(onEndTurn).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onEndTurn).toHaveBeenCalledOnce();
    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY * 2);
    });
    expect(onEndTurn).toHaveBeenCalledOnce();
  });

  it.each(["playable hand", "inactive battle", "card play in progress"] as const)(
    "rechecks %s when the countdown expires",
    (change) => {
      const onEndTurn = vi.fn();
      const initialState = makeEmptyHandBattle().battleState;
      const { rerender } = renderHook(
        ({ battleState, hasActiveBattle, busy }) =>
          useAutoEndTurnUnderTest({
            ...baseOptions,
            battleState,
            hasActiveBattle,
            isCardPlayInProgress: () => busy,
            onEndTurn,
          }),
        { initialProps: { battleState: initialState, hasActiveBattle: true, busy: false } },
      );
      act(() => {
        vi.advanceTimersByTime(AUTO_END_TURN_DELAY / 2);
      });
      rerender({
        battleState: change === "playable hand" ? makeOpenBattle().battleState : initialState,
        hasActiveBattle: change !== "inactive battle",
        busy: change === "card play in progress",
      });
      act(() => {
        vi.advanceTimersByTime(AUTO_END_TURN_DELAY);
      });
      expect(onEndTurn).not.toHaveBeenCalled();
    },
  );

  it.each(["disable", "unmount"] as const)("cancels a pending countdown on %s", (change) => {
    const onEndTurn = vi.fn();
    const battleState = makeEmptyHandBattle().battleState;
    const { rerender, unmount } = renderHook(
      ({ autoEndTurn }) => useAutoEndTurnUnderTest({ ...baseOptions, battleState, autoEndTurn, onEndTurn }),
      { initialProps: { autoEndTurn: true } },
    );
    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY / 2);
    });
    if (change === "disable") rerender({ autoEndTurn: false });
    else unmount();
    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY);
    });
    expect(onEndTurn).not.toHaveBeenCalled();
  });
});
