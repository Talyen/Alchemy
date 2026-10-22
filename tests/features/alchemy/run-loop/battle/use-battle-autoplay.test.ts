import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import { useRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AutoplayCardControl } from "@/features/alchemy/run-loop/battle/battle-context";
import type { BattleCard } from "@/lib/game-data";
import { useBattleAutoplay } from "@/features/alchemy/run-loop/battle/use-battle-autoplay";
import { useBattlePresentationGateRef } from "@/features/alchemy/run-loop/battle/presentation/use-hand-presentation";
import { battlePresentation } from "@/app/battle-presentation";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { AUTOPLAY_POST_PLAY_DELAY_MS, AUTOPLAY_RETRY_DELAY_MS } from "@/lib/game-constants";
import { makeOpenBattle, playableCard } from "./open-battle-fixture";

function autoplayOptions() {
  return {
    enabled: true,
    screen: "battle" as const,
    battleState: makeOpenBattle({ gameMenuOpen: false }).battleState,
    hasActiveBattle: true,
    isCardPlayInProgress: () => false,
    gameMenuOpen: false,
    playCard: vi.fn((_card: BattleCard, _index: number, _control: AutoplayCardControl) => Promise.resolve(true)),
    playWish: vi.fn((_card: BattleCard, _control: AutoplayCardControl) => Promise.resolve(true)),
  };
}
function useAutoplay(options: ReturnType<typeof autoplayOptions>) {
  const wakeRef = useRef<(() => void) | null>(null);
  const onGateChangeRef = useRef(() => wakeRef.current?.());
  const presentationGateRef = useBattlePresentationGateRef(battlePresentation, onGateChangeRef);
  useBattleAutoplay({ ...options, presentationGateRef, wakeRef });
}
const advance = async (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));
beforeEach(() => {
  vi.useFakeTimers();
  resetBattlePresentationAndRun();
  useUiStore.getState().setCardInspection(null);
  useUiStore.getState().setEnemyInspectionOpen(false);
});
afterEach(() => vi.useRealTimers());

describe("autoplay hook integration", () => {
  it("paces a newly granted Wish, then resumes card play with the current callback", async () => {
    const options = autoplayOptions();
    const { rerender, unmount } = renderHook(useAutoplay, { initialProps: options });
    await advance(100);
    expect(options.playCard).toHaveBeenCalledOnce();
    const wish = { ...playableCard, uid: 9 };
    const wishState = { ...options.battleState, wishOptions: [wish] };
    rerender({ ...options, battleState: wishState });
    await advance(AUTOPLAY_POST_PLAY_DELAY_MS - 101);
    expect(options.playWish).not.toHaveBeenCalled();
    await advance(1);
    expect(options.playWish).toHaveBeenCalledExactlyOnceWith(
      wish,
      expect.objectContaining({ canCommit: expect.any(Function) }),
      wishState,
    );
    const latest = autoplayOptions();
    rerender(latest);
    await advance(AUTOPLAY_POST_PLAY_DELAY_MS);
    expect(latest.playCard).toHaveBeenCalledOnce();
    expect(options.playWish).toHaveBeenCalledOnce();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["card", "wish"] as const)("rechecks live gates during a %s preview", async (mode) => {
    let control: AutoplayCardControl | undefined;
    let finish!: (played: boolean) => void;
    const preview = new Promise<boolean>((resolve) => {
      finish = resolve;
    });
    const options = autoplayOptions();
    const wish = { ...playableCard, uid: 9 };
    options.battleState = { ...options.battleState, wishOptions: mode === "wish" ? [wish] : null };
    options.playCard.mockImplementation((_card, _index, value) => {
      control = value;
      return preview;
    });
    options.playWish.mockImplementation((_card, value) => {
      control = value;
      return preview;
    });
    const { rerender, unmount } = renderHook(useAutoplay, { initialProps: options });
    expect(control?.canCommit()).toBe(true);
    expect(mode === "wish" ? options.playCard : options.playWish).not.toHaveBeenCalled();
    rerender({ ...options, gameMenuOpen: true });
    expect(control?.canCommit()).toBe(false);
    rerender(options);
    expect(control?.canCommit()).toBe(true);
    act(() => battlePresentation.getState().setCardTransferInProgress(true));
    expect(control?.canCommit()).toBe(false);
    act(() => battlePresentation.getState().setCardTransferInProgress(false));
    rerender({ ...options, battleState: { ...options.battleState, wishOptions: mode === "wish" ? null : [wish] } });
    expect(control?.canCommit()).toBe(false);
    unmount();
    expect(control?.signal.aborted).toBe(true);
    expect(control?.canCommit()).toBe(false);
    await act(async () => {
      finish(false);
      await preview;
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["cards", "enemy"] as const)("resumes after inspecting %s without toggling autoplay", async (kind) => {
    const options = autoplayOptions();
    if (kind === "cards") useUiStore.getState().setCardInspection("draw");
    else useUiStore.getState().setEnemyInspectionOpen(true);
    const { unmount } = renderHook(useAutoplay, { initialProps: options });
    await advance(AUTOPLAY_RETRY_DELAY_MS * 3);
    expect(options.playCard).not.toHaveBeenCalled();
    act(() => {
      useUiStore.getState().setCardInspection(null);
      useUiStore.getState().setEnemyInspectionOpen(false);
    });
    await advance(AUTOPLAY_RETRY_DELAY_MS);
    expect(options.playCard).toHaveBeenCalledOnce();
    unmount();
  });

  it("wakes on transfer completion and preserves pacing across presentation updates", async () => {
    const options = autoplayOptions();
    battlePresentation.getState().setCardTransferInProgress(true);
    const { unmount } = renderHook(useAutoplay, { initialProps: options });
    await advance(0);
    expect(options.playCard).not.toHaveBeenCalled();
    await act(async () => {
      battlePresentation.getState().setCardTransferInProgress(false);
      await Promise.resolve();
    });
    expect(options.playCard).toHaveBeenCalledOnce();
    act(() => battlePresentation.getState().setHiddenHandCardKeys(() => ["slash-1"]));
    await advance(100);
    expect(options.playCard).toHaveBeenCalledOnce();
    act(() => battlePresentation.getState().setHiddenHandCardKeys(() => []));
    await advance(AUTOPLAY_POST_PLAY_DELAY_MS - 101);
    expect(options.playCard).toHaveBeenCalledOnce();
    await advance(1);
    expect(options.playCard).toHaveBeenCalledTimes(2);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
