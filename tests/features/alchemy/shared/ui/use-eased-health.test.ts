import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installRafStub } from "../../../../helpers/animation-test";
import { useEasedHealth } from "@/features/alchemy/shared/ui/use-eased-health";

describe("useEasedHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("resets inactive health and cancels interrupted animations on deactivation and unmount", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));

    const onFinished = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ from, to, active }: { from: number; to: number; active: boolean }) =>
        useEasedHealth({ from, to, active, onFinished }),
      { initialProps: { from: 10, to: 10, active: false } },
    );

    rerender({ from: 20, to: 20, active: false });
    expect(result.current.displayHealth).toBe(20);

    rerender({ from: 20, to: 20, active: true });
    expect(result.current.displayHealth).toBe(20);

    rerender({ from: 20, to: 30, active: true });
    expect(frames.size).toBe(1);
    act(() => {
      const [id, callback] = frames.entries().next().value!;
      frames.delete(id);
      callback(100);
    });
    expect(result.current.progressHealth).toBeGreaterThan(20);
    rerender({ from: 10, to: 30, active: true });
    expect(result.current.progressHealth).toBe(10);
    rerender({ from: 22, to: 30, active: false });
    expect(result.current.displayHealth).toBe(22);
    expect(frames.size).toBe(0);
    expect(onFinished).not.toHaveBeenCalled();
    rerender({ from: 22, to: 30, active: true });
    unmount();
    expect(frames.size).toBe(0);
    expect(onFinished).not.toHaveBeenCalled();
  });

  it.each([
    ["cubic", 18.75, 19],
    ["linear", 15, 15],
  ] as const)(
    "keeps the %s meter and number in sync and finishes with the latest callback",
    (easing, progress, display) => {
      vi.spyOn(performance, "now").mockReturnValue(0);
      const frames = installRafStub();
      const onFinished = vi.fn();

      const { result, rerender } = renderHook(
        ({ callback }) =>
          useEasedHealth({ from: 10, to: 20, active: true, durationMs: 1000, easing, onFinished: callback }),
        { initialProps: { callback: onFinished } },
      );

      act(() => {
        frames.shift()?.(500);
      });

      expect(result.current.progressHealth).toBeCloseTo(progress);
      expect(result.current.displayHealth).toBe(display);
      expect(onFinished).not.toHaveBeenCalled();

      const latestCallback = vi.fn();
      rerender({ callback: latestCallback });
      expect(frames).toHaveLength(1);
      act(() => {
        frames.shift()?.(1000);
      });

      expect(result.current.progressHealth).toBe(20);
      expect(result.current.displayHealth).toBe(20);
      expect(onFinished).not.toHaveBeenCalled();
      expect(latestCallback).toHaveBeenCalledOnce();
    },
  );

  it("settles the refill on the first frame when reduced motion is requested", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.spyOn(performance, "now").mockReturnValue(0);
    const frames = installRafStub();
    const onFinished = vi.fn();
    const { result } = renderHook(() =>
      useEasedHealth({ from: 10, to: 20, active: true, durationMs: 1000, onFinished }),
    );
    act(() => frames.shift()?.(0));
    expect(result.current.displayHealth).toBe(20);
    expect(result.current.progressHealth).toBe(20);
    expect(onFinished).toHaveBeenCalledOnce();
    expect(frames).toHaveLength(0);
  });
});
