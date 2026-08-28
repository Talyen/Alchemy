import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSequentialFadeSwap } from "@/features/alchemy/shared/ui/use-sequential-fade-swap";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { MOTION_FADE_MS } from "@/lib/game-constants";

describe("useSequentialFadeSwap", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("swaps shown identity after the fade-out delay and calls onSwap", () => {
    vi.useFakeTimers();
    const onSwap = vi.fn();
    const { result, rerender } = renderHook(
      ({ target }: { target: string }) => useSequentialFadeSwap({ target, durationMs: MOTION_FADE_MS, onSwap }),
      { initialProps: { target: "cards" } },
    );

    expect(result.current.shown).toBe("cards");
    expect(result.current.phase).toBe("idle");

    rerender({ target: "bestiary" });
    expect(result.current.phase).toBe("exit");
    expect(result.current.shown).toBe("cards");
    expect(onSwap).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(resolveGameDelay(MOTION_FADE_MS));
    });

    expect(result.current.shown).toBe("bestiary");
    expect(result.current.phase).toBe("enter");
    expect(onSwap).toHaveBeenCalledOnce();
  });

  it("cancels exit when the target reverts before the fade-out timer", () => {
    vi.useFakeTimers();
    const onSwap = vi.fn();
    const { result, rerender } = renderHook(
      ({ target }: { target: string }) => useSequentialFadeSwap({ target, durationMs: MOTION_FADE_MS, onSwap }),
      { initialProps: { target: "cards" } },
    );

    rerender({ target: "bestiary" });
    expect(result.current.phase).toBe("exit");

    rerender({ target: "cards" });
    expect(result.current.phase).toBe("enter");
    expect(result.current.shown).toBe("cards");
    expect(onSwap).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(resolveGameDelay(MOTION_FADE_MS));
    });

    expect(result.current.shown).toBe("cards");
    expect(result.current.phase).toBe("enter");
    expect(onSwap).not.toHaveBeenCalled();
  });
});
