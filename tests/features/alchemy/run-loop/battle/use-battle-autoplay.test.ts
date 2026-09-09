import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBattleAutoplay } from "@/features/alchemy/run-loop/battle/use-battle-autoplay";
import { isBattlePlaybackBlocked } from "@/features/alchemy/run-loop/battle/autoplay-driver";
import { useBattlePresentationGateRef } from "@/features/alchemy/run-loop/battle/presentation/use-hand-presentation";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { AUTOPLAY_POST_PLAY_DELAY_MS, AUTOPLAY_RETRY_DELAY_MS } from "@/lib/game-constants";
import { makeOpenBattle } from "./open-battle-fixture";

const openBattle = makeOpenBattle({ gameMenuOpen: false });

describe("isBattlePlaybackBlocked", () => {
  it("blocks when the game menu is open", () => {
    expect(isBattlePlaybackBlocked({ ...openBattle, gameMenuOpen: true })).toBe(true);
  });
});

function useAutoplayUnderTest(
  options: Omit<Parameters<typeof useBattleAutoplay>[0], "presentationGateRef" | "wakeRef">,
) {
  const wakeRef = useRef<(() => void) | null>(null);
  const onGateChangeRef = useRef(() => {
    wakeRef.current?.();
  });
  const presentationGateRef = useBattlePresentationGateRef(onGateChangeRef);
  useBattleAutoplay({ ...options, presentationGateRef, wakeRef });
}

describe("useBattleAutoplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetBattlePresentationAndRun();
    useUiStore.getState().setCardInspection(null);
    useUiStore.getState().setEnemyInspectionOpen(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["cards", "enemy"] as const)(
    "pauses while inspecting %s and resumes without toggling the autoplay setting",
    async (kind) => {
      const playCard = vi.fn(() => true);
      if (kind === "cards") useUiStore.getState().setCardInspection("draw");
      else useUiStore.getState().setEnemyInspectionOpen(true);
      const { unmount } = renderHook(() =>
        useAutoplayUnderTest({
          enabled: true,
          screen: "battle",
          battleState: openBattle.battleState,
          hasActiveBattle: true,
          isCardPlayInProgress: () => false,
          gameMenuOpen: false,
          playCard,
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(AUTOPLAY_RETRY_DELAY_MS * 3);
      });
      expect(playCard).not.toHaveBeenCalled();
      await act(async () => {
        if (kind === "cards") useUiStore.getState().setCardInspection(null);
        else useUiStore.getState().setEnemyInspectionOpen(false);
        await vi.advanceTimersByTimeAsync(AUTOPLAY_RETRY_DELAY_MS);
      });
      expect(playCard).toHaveBeenCalledOnce();
      unmount();
    },
  );

  it("plays the first playable card when enabled", () => {
    const playCard = vi.fn(() => true);
    renderHook(() =>
      useAutoplayUnderTest({
        enabled: true,
        screen: "battle",
        battleState: openBattle.battleState,
        hasActiveBattle: true,
        isCardPlayInProgress: () => false,
        gameMenuOpen: false,
        playCard,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_RETRY_DELAY_MS);
    });

    expect(playCard).toHaveBeenCalled();
  });

  it("does not play while blocked by hidden cards", () => {
    const playCard = vi.fn(() => true);
    useBattlePresentationStore.setState({ hiddenHandCardKeys: ["slash-1"] });
    renderHook(() =>
      useAutoplayUnderTest({
        enabled: true,
        screen: "battle",
        battleState: openBattle.battleState,
        hasActiveBattle: true,
        isCardPlayInProgress: () => false,
        gameMenuOpen: false,
        playCard,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_RETRY_DELAY_MS * 3);
    });

    expect(playCard).not.toHaveBeenCalled();
  });

  it("plays immediately when a blocking transfer completes", async () => {
    const playCard = vi.fn(() => true);
    useBattlePresentationStore.setState({ cardTransferInProgress: true });
    renderHook(() =>
      useAutoplayUnderTest({
        enabled: true,
        screen: "battle",
        battleState: openBattle.battleState,
        hasActiveBattle: true,
        isCardPlayInProgress: () => false,
        gameMenuOpen: false,
        playCard,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(playCard).not.toHaveBeenCalled();

    await act(async () => {
      useBattlePresentationStore.setState({ cardTransferInProgress: false });
      await Promise.resolve();
    });

    expect(playCard).toHaveBeenCalled();
  });

  it("preserves post-play pacing across presentation-store updates", async () => {
    const playCard = vi.fn(() => true);
    const { unmount } = renderHook(() =>
      useAutoplayUnderTest({
        enabled: true,
        screen: "battle",
        battleState: openBattle.battleState,
        hasActiveBattle: true,
        isCardPlayInProgress: () => false,
        gameMenuOpen: false,
        playCard,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
      useBattlePresentationStore.getState().setHiddenHandCardKeys(() => ["orphaned-card"]);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(playCard).toHaveBeenCalledOnce();
    await act(async () => {
      useBattlePresentationStore.getState().setHiddenHandCardKeys(() => []);
      await vi.advanceTimersByTimeAsync(AUTOPLAY_POST_PLAY_DELAY_MS - 101);
    });
    expect(playCard).toHaveBeenCalledOnce();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(playCard).toHaveBeenCalledTimes(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
