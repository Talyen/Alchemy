import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScreenTransitions } from "@/features/alchemy/shell/use-screen-transitions";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";
import { resetRunDomainStore, setRunSession } from "../../../helpers/run-domain-store-test";
import { readRunResumeScreen } from "@/features/alchemy/shared/stores/run-reads";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
beforeEach(() => {
  vi.useFakeTimers();
  resetRunDomainStore();
});
afterEach(() => vi.useRealTimers());

function navigation() {
  const prepareScreen = vi.fn();
  const showScreen = vi.fn();
  return {
    prepareScreen,
    showScreen,
    ...createScreenNavigation({ readScreen: () => "battle", prepareScreen, showScreen }),
  };
}

describe("screen navigation", () => {
  it("completes gameplay before delaying presentation, without a rendered-screen callback", () => {
    const nav = navigation();
    const prepare = vi.fn(() => expect(nav.showScreen).not.toHaveBeenCalled());
    nav.navigateTo("rewards", prepare);
    expect(prepare).toHaveBeenCalledOnce();
    expect(nav.prepareScreen).toHaveBeenCalledExactlyOnceWith("rewards");
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
    expect(nav.prepareScreen).not.toHaveBeenCalled();
    expect(nav.showScreen).not.toHaveBeenCalled();
  });

  it("does not schedule navigation when gameplay preparation fails", () => {
    const nav = navigation();
    expect(() =>
      nav.navigateTo("rewards", () => {
        throw new Error("failed");
      }),
    ).toThrow("failed");
    expect(nav.prepareScreen).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("lets a preparation redirect replace the original destination", () => {
    const nav = navigation();
    nav.navigateTo("rewards", () => nav.navigateTo("menu"));
    vi.runAllTimers();
    expect(nav.prepareScreen).toHaveBeenCalledExactlyOnceWith("menu");
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
    act(() => result.current.navigateTo("rewards"));
    expect(readRunResumeScreen()).toBe("rewards");
    unmount();
    vi.runAllTimers();
    expect(show).not.toHaveBeenCalled();
    expect(readRunResumeScreen()).toBe("rewards");
  });

  it("rejects transitions outside the screen policy", () => {
    const nav = navigation();
    expect(() => nav.navigateTo("character-select")).toThrow("Disallowed screen transition");
    expect(nav.prepareScreen).not.toHaveBeenCalled();
  });
});
