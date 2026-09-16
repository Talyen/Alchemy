import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppDisplayEffects, useGlobalErrorHandlers } from "@/app/use-app-effects";
import { isDesktop, setDisplayMode as setPlatformDisplayMode } from "@/lib/platform";
import { logError } from "@/lib/error-logger";

vi.mock("@/lib/platform", () => ({
  isDesktop: vi.fn(() => false),
  setDisplayMode: vi.fn(),
}));

vi.mock("@/lib/error-logger", () => ({
  logError: vi.fn(),
}));

describe("useAppDisplayEffects", () => {
  let stageEl: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    stageEl = document.createElement("div");
    document.body.appendChild(stageEl);
    delete document.body.dataset.displayMode;
  });

  afterEach(() => {
    stageEl.remove();
  });

  it("sets document.body dataset.displayMode", () => {
    const stageRef = { current: stageEl };
    renderHook(() => useAppDisplayEffects({ displayMode: "fullscreen", brightness: 100, stageRef }));
    expect(document.body.dataset.displayMode).toBe("fullscreen");
  });

  it("calls setPlatformDisplayMode when in desktop environment", () => {
    vi.mocked(isDesktop).mockReturnValue(true);
    const stageRef = { current: stageEl };
    renderHook(() => useAppDisplayEffects({ displayMode: "windowed", brightness: 100, stageRef }));
    expect(setPlatformDisplayMode).toHaveBeenCalledWith("windowed");
  });

  it("does not call setPlatformDisplayMode when not in desktop environment", () => {
    vi.mocked(isDesktop).mockReturnValue(false);
    const stageRef = { current: stageEl };
    renderHook(() => useAppDisplayEffects({ displayMode: "windowed", brightness: 100, stageRef }));
    expect(setPlatformDisplayMode).not.toHaveBeenCalled();
  });

  it("sets brightness filter on stage when brightness is over 100", () => {
    const stageRef = { current: stageEl };
    renderHook(() => useAppDisplayEffects({ displayMode: "windowed", brightness: 125, stageRef }));
    expect(stageEl.style.filter).toBe("brightness(1.25)");
  });

  it("clears brightness filter when brightness is 100 or lower", () => {
    const stageRef = { current: stageEl };
    stageEl.style.filter = "brightness(1.25)";
    renderHook(() => useAppDisplayEffects({ displayMode: "windowed", brightness: 90, stageRef }));
    expect(stageEl.style.filter).toBe("");
  });
});

describe("useGlobalErrorHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs window error events to logError", () => {
    const { unmount } = renderHook(() => useGlobalErrorHandlers());
    const errorEvent = new ErrorEvent("error", {
      message: "Test runtime failure",
      filename: "test.js",
      lineno: 42,
      colno: 7,
      error: new Error("Test runtime failure"),
    });

    window.dispatchEvent(errorEvent);

    expect(logError).toHaveBeenCalledWith(
      "Test runtime failure",
      "global",
      { filename: "test.js", lineno: 42, colno: 7 },
      expect.stringContaining("Error: Test runtime failure"),
    );

    unmount();
  });

  it("logs unhandled promise rejections to logError", () => {
    const { unmount } = renderHook(() => useGlobalErrorHandlers());
    const rejectionError = new Error("Async failure");
    const rejectionEvent = new PromiseRejectionEvent("unhandledrejection", {
      promise: Promise.resolve(),
      reason: rejectionError,
    });

    window.dispatchEvent(rejectionEvent);

    expect(logError).toHaveBeenCalledWith(
      "Async failure",
      "promise",
      undefined,
      expect.stringContaining("Error: Async failure"),
    );

    unmount();
  });

  it("unregisters global listeners on unmount", () => {
    const { unmount } = renderHook(() => useGlobalErrorHandlers());
    unmount();

    window.dispatchEvent(new ErrorEvent("error", { message: "After unmount" }));
    window.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.resolve(),
        reason: "After unmount",
      }),
    );

    expect(logError).not.toHaveBeenCalled();
  });
});
