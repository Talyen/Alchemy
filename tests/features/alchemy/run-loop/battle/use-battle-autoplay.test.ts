import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AutoplayCardControl } from "@/features/alchemy/run-loop/battle/battle-context";
import type { BattleCard } from "@/lib/game-data";
import { useBattleAutoplay } from "@/features/alchemy/run-loop/battle/use-battle-autoplay";
import { useBattlePresentationGateRef } from "@/features/alchemy/run-loop/battle/presentation/use-hand-presentation";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { AUTOPLAY_POST_PLAY_DELAY_MS, AUTOPLAY_RETRY_DELAY_MS } from "@/lib/game-constants";
import { makeOpenBattle, playableCard } from "./open-battle-fixture";

const openBattle = makeOpenBattle({ gameMenuOpen: false });

function useAutoplayUnderTest(
  options: Omit<Parameters<typeof useBattleAutoplay>[0], "presentationGateRef" | "wakeRef" | "playWish"> &
    Partial<Pick<Parameters<typeof useBattleAutoplay>[0], "playWish">>,
) {
  const wakeRef = useRef<(() => void) | null>(null);
  const onGateChangeRef = useRef(() => {
    wakeRef.current?.();
  });
  const presentationGateRef = useBattlePresentationGateRef(onGateChangeRef);
  const { playWish = () => false, ...rest } = options;
  useBattleAutoplay({ ...rest, playWish, presentationGateRef, wakeRef });
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

  it("selects a newly granted Wish after pacing, then returns to Card play", async () => {
    const playCard = vi.fn(() => true);
    const playWish = vi.fn(() => true);
    const options = {
      enabled: true,
      screen: "battle" as const,
      battleState: openBattle.battleState,
      hasActiveBattle: true,
      isCardPlayInProgress: () => false,
      gameMenuOpen: false,
      playCard,
      playWish,
    };
    const { rerender, unmount } = renderHook(useAutoplayUnderTest, { initialProps: options });
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(playCard).toHaveBeenCalledOnce();

    const wish = { ...playableCard, uid: 9 };
    rerender({ ...options, battleState: { ...options.battleState, wishOptions: [wish] } });
    await act(async () => vi.advanceTimersByTimeAsync(AUTOPLAY_POST_PLAY_DELAY_MS - 101));
    expect(playWish).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(playWish).toHaveBeenCalledExactlyOnceWith(
      wish,
      expect.objectContaining({ canCommit: expect.any(Function) }),
    );
    expect(playCard).toHaveBeenCalledOnce();

    const latestPlayCard = vi.fn(() => true);
    rerender({ ...options, playCard: latestPlayCard });
    await act(async () => vi.advanceTimersByTimeAsync(AUTOPLAY_POST_PLAY_DELAY_MS));
    expect(latestPlayCard).toHaveBeenCalledOnce();
    expect(playWish).toHaveBeenCalledOnce();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["card", "wish"] as const)("rechecks live gates during a %s preview", async (mode) => {
    const wish = { ...playableCard, uid: 9 };
    let previewControl: AutoplayCardControl | undefined;
    let finishPreview: (played: boolean) => void = () => {};
    const preview = new Promise<boolean>((resolve) => {
      finishPreview = resolve;
    });
    const play = (control: AutoplayCardControl) => {
      previewControl = control;
      return preview;
    };
    const options = {
      enabled: true,
      screen: "battle" as const,
      battleState: { ...openBattle.battleState, wishOptions: mode === "wish" ? [wish] : null },
      hasActiveBattle: true,
      isCardPlayInProgress: () => false,
      gameMenuOpen: false,
      playCard: vi.fn((_card: BattleCard, _index: number, control: AutoplayCardControl) => play(control)),
      playWish: vi.fn((_card: BattleCard, control: AutoplayCardControl) => play(control)),
    };
    const { rerender, unmount } = renderHook(useAutoplayUnderTest, { initialProps: options });
    expect(previewControl?.canCommit()).toBe(true);
    expect(mode === "wish" ? options.playCard : options.playWish).not.toHaveBeenCalled();
    rerender({ ...options, gameMenuOpen: true });
    expect(previewControl?.canCommit()).toBe(false);
    rerender(options);
    expect(previewControl?.canCommit()).toBe(true);
    act(() => useBattlePresentationStore.setState({ cardTransferInProgress: true }));
    expect(previewControl?.canCommit()).toBe(false);
    act(() => useBattlePresentationStore.setState({ cardTransferInProgress: false }));
    rerender({ ...options, battleState: { ...options.battleState, wishOptions: mode === "wish" ? null : [wish] } });
    expect(previewControl?.canCommit()).toBe(false);
    rerender(options);
    expect(previewControl?.canCommit()).toBe(true);
    unmount();
    expect(previewControl?.signal.aborted).toBe(true);
    expect(previewControl?.canCommit()).toBe(false);
    await act(async () => {
      finishPreview(false);
      await preview;
    });
    expect(vi.getTimerCount()).toBe(0);
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
