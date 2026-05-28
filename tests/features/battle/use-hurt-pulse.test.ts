// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHurtPulse } from "@/features/alchemy/ui/battle/use-hurt-pulse";
import { HURT_FLASH_DURATION_MS, HURT_SPARK_DURATION_MS } from "@/lib/game-constants";

const HURT_VFX_DURATION_MS = Math.max(HURT_FLASH_DURATION_MS, HURT_SPARK_DURATION_MS);

describe("useHurtPulse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not pulse when mounted with a stale positive token", () => {
    const { result } = renderHook(({ token }) => useHurtPulse(token), {
      initialProps: { token: 3 },
    });

    expect(result.current.pulse).toBeNull();
  });

  it("pulses when the hurt flash token strictly increases", () => {
    const { result, rerender } = renderHook(({ token }) => useHurtPulse(token), {
      initialProps: { token: 3 },
    });

    rerender({ token: 4 });

    expect(result.current.pulse).toBe(4);
  });

  it("does not re-pulse when the token is unchanged", () => {
    const { result, rerender } = renderHook(({ token }) => useHurtPulse(token), {
      initialProps: { token: 3 },
    });

    rerender({ token: 4 });
    expect(result.current.pulse).toBe(4);

    rerender({ token: 4 });
    expect(result.current.pulse).toBe(4);
  });

  it("pulses again on a second increase before the VFX timer elapses", () => {
    const { result, rerender } = renderHook(({ token }) => useHurtPulse(token), {
      initialProps: { token: 3 },
    });

    rerender({ token: 4 });
    expect(result.current.pulse).toBe(4);

    rerender({ token: 5 });
    expect(result.current.pulse).toBe(5);
  });

  it("does not start a new pulse when the token decreases after a reset", () => {
    const { result, rerender } = renderHook(({ token }) => useHurtPulse(token), {
      initialProps: { token: 4 },
    });

    rerender({ token: 5 });
    expect(result.current.pulse).toBe(5);

    act(() => {
      vi.advanceTimersByTime(HURT_VFX_DURATION_MS);
    });
    expect(result.current.pulse).toBeNull();

    rerender({ token: 0 });
    expect(result.current.pulse).toBeNull();
  });
});
