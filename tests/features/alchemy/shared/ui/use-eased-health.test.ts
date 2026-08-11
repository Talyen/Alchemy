// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useEasedHealth } from "@/features/alchemy/shared/ui/use-eased-health";

describe("useEasedHealth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("synchronizes an inactive health change before a no-op animation", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

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
});
