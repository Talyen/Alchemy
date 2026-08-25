// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installRafStub } from "../../../../helpers/animation-test";
import { useEasedHealth } from "@/features/alchemy/shared/ui/use-eased-health";

describe("useEasedHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("synchronizes an inactive health change before a no-op animation", () => {
    const frames = installRafStub();

    const { result, rerender } = renderHook(
      ({ from, to, active }: { from: number; to: number; active: boolean }) => useEasedHealth({ from, to, active }),
      { initialProps: { from: 10, to: 10, active: false } },
    );

    rerender({ from: 20, to: 20, active: false });
    expect(result.current.displayHealth).toBe(20);

    rerender({ from: 20, to: 20, active: true });
    expect(result.current.displayHealth).toBe(20);

    act(() => {
      frames.shift()?.(0);
    });

    expect(result.current.displayHealth).toBe(20);
  });

  it("drives the displayed number and progress from one eased health value", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);
    const frames = installRafStub();
    const onFinished = vi.fn();

    const { result } = renderHook(() =>
      useEasedHealth({ from: 10, to: 20, active: true, durationMs: 1000, onFinished }),
    );

    act(() => {
      frames.shift()?.(500);
    });

    expect(result.current.progressHealth).toBeCloseTo(18.75);
    expect(result.current.displayHealth).toBe(19);
    expect(onFinished).not.toHaveBeenCalled();

    act(() => {
      frames.shift()?.(1000);
    });

    expect(result.current.progressHealth).toBe(20);
    expect(result.current.displayHealth).toBe(20);
    expect(onFinished).toHaveBeenCalledOnce();
  });

  it("supports linear easing for constant-velocity meters", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);
    const frames = installRafStub();

    const { result } = renderHook(() =>
      useEasedHealth({ from: 10, to: 20, active: true, durationMs: 1000, easing: "linear" }),
    );

    act(() => {
      frames.shift()?.(500);
    });

    expect(result.current.progressHealth).toBeCloseTo(15);
    expect(result.current.displayHealth).toBe(15);
  });
});
