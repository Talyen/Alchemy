import { describe, expect, it, vi } from "vitest";
import { createScreenTransition } from "@/features/alchemy/shell/screen-transition";
import { CONSTANTS } from "@/features/alchemy/shared/types";

describe("createScreenTransition", () => {
  it("applies immediate setScreen transitions", () => {
    const setScreen = vi.fn();
    const navigateTo = vi.fn();
    const onCommit = vi.fn();
    const transitionScreen = createScreenTransition({ navigateTo, setScreen });

    transitionScreen(CONSTANTS.SCREENS.GAME_OVER, { immediate: true, onCommit });

    expect(setScreen).toHaveBeenCalledWith(CONSTANTS.SCREENS.GAME_OVER);
    expect(onCommit).toHaveBeenCalledOnce();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("routes delayed transitions through the timer and setScreen", () => {
    const setScreen = vi.fn();
    const navigateTo = vi.fn();
    const timer = {
      current: {
        clearAll: vi.fn(),
        setTimeout: vi.fn((callback: () => void) => callback()),
      },
    };
    const transitionScreen = createScreenTransition({ navigateTo, setScreen }, timer);

    transitionScreen(CONSTANTS.SCREENS.REWARDS, { delayMs: 250 });

    expect(timer.current.clearAll).toHaveBeenCalledOnce();
    expect(timer.current.setTimeout).toHaveBeenCalledWith(expect.any(Function), 250);
    expect(setScreen).toHaveBeenCalledWith(CONSTANTS.SCREENS.REWARDS);
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("skips delayed transitions when guard returns false at apply time", () => {
    const setScreen = vi.fn();
    const navigateTo = vi.fn();
    let hasActiveRun = true;
    const timer = {
      current: {
        clearAll: vi.fn(),
        setTimeout: vi.fn((callback: () => void) => callback()),
      },
    };
    const transitionScreen = createScreenTransition({ navigateTo, setScreen }, timer);

    transitionScreen(CONSTANTS.SCREENS.REWARDS, {
      delayMs: 250,
      guard: () => hasActiveRun,
    });
    expect(setScreen).toHaveBeenCalledWith(CONSTANTS.SCREENS.REWARDS);

    setScreen.mockClear();
    hasActiveRun = false;
    transitionScreen(CONSTANTS.SCREENS.REWARDS, {
      delayMs: 250,
      guard: () => hasActiveRun,
    });
    expect(setScreen).not.toHaveBeenCalled();
  });

  it("uses navigateTo for standard transitions", () => {
    const setScreen = vi.fn();
    const navigateTo = vi.fn();
    const onCommit = vi.fn();
    const transitionScreen = createScreenTransition({ navigateTo, setScreen });

    transitionScreen(CONSTANTS.SCREENS.DESTINATION, { onCommit });

    expect(navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.DESTINATION, onCommit);
    expect(setScreen).not.toHaveBeenCalled();
  });
});
