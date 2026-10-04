import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { useFadePresence, useSequentialFadeSwap, FadeSlot } from "@/features/alchemy/shared/ui/use-fade";
import { MOTION_FADE_MS } from "@/lib/game-constants";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("keeps a reopened panel mounted when its previous exit timer would fire", () => {
  vi.useFakeTimers();
  const { result, rerender } = renderHook((open) => useFadePresence(open, MOTION_FADE_MS), { initialProps: false });
  expect(result.current.mounted).toBe(false);
  rerender(true);
  expect(result.current).toEqual({ mounted: true, phase: "enter" });
  rerender(false);
  expect(result.current).toEqual({ mounted: true, phase: "exit" });
  act(() => vi.advanceTimersByTime(MOTION_FADE_MS / 2));
  rerender(true);
  act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
  expect(result.current).toEqual({ mounted: true, phase: "enter" });
  rerender(false);
  act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
  expect(result.current.mounted).toBe(false);
});

it("swaps to the latest target once, without showing or firing callbacks for a cancelled target", () => {
  vi.useFakeTimers();
  const onSwap = vi.fn();
  const { result, rerender, unmount } = renderHook(
    (target) => useSequentialFadeSwap({ target, durationMs: MOTION_FADE_MS, onSwap }),
    { initialProps: "a" },
  );
  rerender("b");
  expect(result.current).toEqual({ shown: "a", phase: "exit" });
  act(() => vi.advanceTimersByTime(MOTION_FADE_MS / 2));
  rerender("c");
  act(() => vi.advanceTimersByTime(MOTION_FADE_MS / 2));
  expect(result.current.shown).toBe("a");
  expect(onSwap).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(MOTION_FADE_MS / 2));
  expect(result.current).toEqual({ shown: "c", phase: "enter" });
  expect(onSwap).toHaveBeenCalledOnce();
  rerender("d");
  unmount();
  act(() => vi.runAllTimers());
  expect(onSwap).toHaveBeenCalledOnce();
});

it("cancels a swap completely when its target reverts before the fade ends", () => {
  vi.useFakeTimers();
  const onSwap = vi.fn();
  const { result, rerender } = renderHook(
    (target) => useSequentialFadeSwap({ target, durationMs: MOTION_FADE_MS, onSwap }),
    { initialProps: "a" },
  );
  rerender("b");
  rerender("a");
  act(() => vi.runAllTimers());
  expect(result.current).toEqual({ shown: "a", phase: "enter" });
  expect(onSwap).not.toHaveBeenCalled();
});

it("holds outgoing contents and styling inert until the replacement is shown", () => {
  vi.useFakeTimers();
  const { rerender } = render(
    <FadeSlot swapKey="a" className="old-panel" style={{ opacity: 0.8 }}>
      <button>A</button>
    </FadeSlot>,
  );
  const panel = screen.getByRole("button", { name: "A" }).parentElement!;
  rerender(
    <FadeSlot swapKey="b" className="new-panel" style={{ opacity: 1 }}>
      <button>B</button>
    </FadeSlot>,
  );
  expect(screen.queryByText("B")).toBeNull();
  expect(panel.classList.contains("old-panel")).toBe(true);
  expect(panel.style.opacity).toBe("0.8");
  expect(panel.hasAttribute("inert")).toBe(true);
  act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
  expect(screen.queryByText("A")).toBeNull();
  expect(screen.getByRole("button", { name: "B" })).toBeDefined();
  expect(panel.classList.contains("new-panel")).toBe(true);
  expect(panel.style.opacity).toBe("1");
  act(() => vi.advanceTimersByTime(20));
  expect(panel.hasAttribute("inert")).toBe(false);
});
