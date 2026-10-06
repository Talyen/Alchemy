import "../../../helpers/mock-audio";

import { initializeBattleForTest as initializeActiveBattle } from "../../../helpers/run-domain-store-test";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScreenTransitions } from "@/features/alchemy/shell/use-screen-transitions";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";
import { resetRunDomainStore, setRunSession } from "../../../helpers/run-domain-store-test";
import { readRunResumeScreen, readActiveRunScreen } from "@/features/alchemy/shared/stores/run-reads";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setRunProgressActivity, resetNavigation } from "@/features/alchemy/shared/stores/run-session-write-port";
import { showRunScreen } from "@/features/alchemy/shared/stores/navigation-commands";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { emptyShopState, createEmptyRewardState } from "@/lib/active-run-session";

import { dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { defaultBattleState } from "@/lib/battle";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
import { defaultGameSession } from "@/app/application-session";
beforeEach(() => {
  vi.useFakeTimers();
  resetRunDomainStore();
});
afterEach(() => vi.useRealTimers());

function navigation() {
  const showScreen = vi.fn();
  return {
    showScreen,
    ...createScreenNavigation({ readScreen: () => "battle", showScreen }, defaultGameSession),
  };
}

describe("screen navigation", () => {
  it("reports pending navigation until commit or cancellation, including redirects", () => {
    const onPendingChange = vi.fn();
    const showScreen = vi.fn();
    const nav = createScreenNavigation(
      {
        readScreen: () => "battle",
        showScreen,
        onPendingChange,
      },
      defaultGameSession,
    );
    nav.navigateTo("rewards");
    expect(onPendingChange).toHaveBeenLastCalledWith(true);
    nav.cancelPending();
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
    vi.runAllTimers();
    expect(showScreen).not.toHaveBeenCalled();
    nav.navigateTo("rewards", () => nav.navigateTo("menu"));
    expect(onPendingChange).toHaveBeenLastCalledWith(true);
    vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    expect(showScreen).toHaveBeenCalledExactlyOnceWith("menu");
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
  });
  it("completes gameplay before delaying presentation, without a rendered-screen callback", () => {
    const nav = navigation();
    const prepare = vi.fn(() => expect(nav.showScreen).not.toHaveBeenCalled());
    nav.navigateTo("rewards", prepare);
    expect(prepare).toHaveBeenCalledOnce();
    expect(nav.showScreen).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NAVIGATION_DELAY_MS);
    expect(nav.showScreen).toHaveBeenCalledExactlyOnceWith("rewards");
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("rejects a guarded action before gameplay or presentation changes", () => {
    const nav = navigation();
    const prepare = vi.fn();
    nav.transition("rewards", { guard: () => false, prepare });
    vi.runAllTimers();
    expect(prepare).not.toHaveBeenCalled();
    expect(nav.showScreen).not.toHaveBeenCalled();
  });

  it("does not schedule navigation when gameplay preparation fails", () => {
    const nav = navigation();
    expect(() =>
      nav.navigateTo("rewards", () => {
        throw new Error("failed");
      }),
    ).toThrow("failed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("lets a preparation redirect replace the original destination", () => {
    const nav = navigation();
    nav.navigateTo("rewards", () => nav.navigateTo("menu"));
    vi.runAllTimers();
    expect(nav.showScreen).toHaveBeenCalledExactlyOnceWith("menu");
  });

  it("cancels superseded presentation without undoing completed gameplay", () => {
    const nav = navigation();
    const prepare = vi.fn();
    nav.navigateTo("rewards", prepare);
    nav.transition("game-over", { immediate: true, delayMs: 250 });
    vi.runAllTimers();
    expect(prepare).toHaveBeenCalledOnce();
    expect(nav.showScreen).toHaveBeenCalledExactlyOnceWith("game-over");
  });

  it("keeps the resume activity when React unmounts before the screen is shown", () => {
    setRunSession({ hasActiveRun: true });
    const show = vi.fn();
    const { result, unmount } = renderHook(() => useScreenTransitions("battle", show), { reactStrictMode: true });
    act(() =>
      result.current.navigateTo("rewards", () =>
        dispatchRunSessionCommand(
          (transaction) => acceptCommand(setRunProgressActivity(transaction, "rewards")),
          undefined,
          defaultGameSession,
        ),
      ),
    );
    expect(readRunResumeScreen(defaultGameSession)).toBe("rewards");
    unmount();
    vi.runAllTimers();
    expect(show).not.toHaveBeenCalled();
    expect(readRunResumeScreen(defaultGameSession)).toBe("rewards");
  });

  it("rejects transitions outside the screen policy", () => {
    const nav = navigation();
    expect(() => nav.navigateTo("character-select")).toThrow("Disallowed screen transition");
  });

  it("resumes a saved run through the same delayed preparation and cancellation path", () => {
    const showScreen = vi.fn();
    const nav = createScreenNavigation({ readScreen: () => "collection", showScreen }, defaultGameSession);
    expect(() => nav.navigateTo("rewards")).toThrow("Disallowed screen transition");
    nav.resumeTo("rewards");
    expect(showScreen).not.toHaveBeenCalled();
    nav.cancelPending();
    vi.runAllTimers();
    expect(showScreen).not.toHaveBeenCalled();
    expect(() => nav.resumeTo("run-victory")).toThrow("Disallowed run resume transition");
  });

  it("treats a guarded no-op as silent even on a disallowed edge", () => {
    const nav = navigation();
    expect(() => nav.transition("character-select", { guard: () => false })).not.toThrow();
    expect(nav.showScreen).not.toHaveBeenCalled();
  });
});

// Exercise the real store writers: presentation must not create visits or alter saves.
it.each(["idle", "shop", "rewards", "battle"] as const)(
  "preserves %s gameplay through display, reset, cancellation, and supersession",
  (kind) => {
    setRunSession({ hasActiveRun: true, rewardState: { ...createEmptyRewardState(), gold: 25 } });
    if (kind !== "idle")
      dispatchRunSessionCommand(
        (transaction) => acceptCommand(setRunProgressActivity(transaction, "rewards")),
        undefined,
        defaultGameSession,
      );
    if (kind === "shop")
      setRunSession({
        activity: { kind, data: { ...emptyShopState(), refreshesLeft: 1, purchasedSlotKeys: ["bought-slot"] } },
      });
    if (kind === "battle") {
      // Store-owned battle setup needs the raw draft; this fixture preserves the same owner as production.
      dispatchGameplayCommand(
        (draft) => acceptCommand(initializeActiveBattle(draft, defaultBattleState())),
        undefined,
        defaultGameSession,
      );
    }
    const before = readGameplayState(defaultGameSession);
    const save = snapshotRun(undefined, defaultGameSession);
    function assertGameplayUnchanged() {
      const after = readGameplayState(defaultGameSession);
      expect(after.session).toBe(before.session);
      expect(after.session.activity).toBe(before.session.activity);
      expect(after.run.activeRun).toBe(before.run.activeRun);
      expect(after.runProfile).toBe(before.runProfile);
      expect(snapshotRun(undefined, defaultGameSession)).toEqual(save);
    }
    showRunScreen("mystery", defaultGameSession);
    assertGameplayUnchanged();
    dispatchRunSessionCommand(
      (transaction) => acceptCommand(resetNavigation(transaction)),
      undefined,
      defaultGameSession,
    );
    assertGameplayUnchanged();
    const nav = createScreenNavigation(
      {
        readScreen: () => readActiveRunScreen(defaultGameSession),
        showScreen: (screen) => showRunScreen(screen, defaultGameSession),
      },
      defaultGameSession,
    );
    nav.resumeTo("shop");
    nav.cancelPending();
    vi.runAllTimers();
    expect(readActiveRunScreen(defaultGameSession)).toBe("menu");
    assertGameplayUnchanged();
    nav.resumeTo("shop");
    nav.resumeTo("rewards", undefined, true);
    vi.runAllTimers();
    expect(readActiveRunScreen(defaultGameSession)).toBe("rewards");
    assertGameplayUnchanged();
  },
);
