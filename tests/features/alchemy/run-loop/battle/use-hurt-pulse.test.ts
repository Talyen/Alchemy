import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useImpactPulse } from "@/features/alchemy/shared/ui/battle/use-hurt-pulse";

const cue = (sequence: number) => ({ sequence, colors: ["#fff"], healthLost: true });

describe("useImpactPulse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not pulse when mounted with a stale cue", () => {
    const { result } = renderHook(({ impactCue }) => useImpactPulse(impactCue), {
      initialProps: { impactCue: cue(3) },
    });

    expect(result.current.pulse).toBeNull();
  });

  it("pulses when the impact sequence strictly increases", () => {
    const { result, rerender } = renderHook(({ impactCue }) => useImpactPulse(impactCue), {
      initialProps: { impactCue: cue(3) },
    });

    rerender({ impactCue: cue(4) });

    expect(result.current.pulse?.sequence).toBe(4);
  });

  it("does not re-pulse when the token is unchanged", () => {
    const { result, rerender } = renderHook(({ impactCue }) => useImpactPulse(impactCue), {
      initialProps: { impactCue: cue(3) },
    });

    const nextCue = cue(4);
    rerender({ impactCue: nextCue });
    expect(result.current.pulse).toBe(nextCue);

    rerender({ impactCue: nextCue });
    expect(result.current.pulse).toBe(nextCue);
  });

  it("pulses again on a second increase before the VFX timer elapses", () => {
    const { result, rerender } = renderHook(({ impactCue }) => useImpactPulse(impactCue), {
      initialProps: { impactCue: cue(3) },
    });

    rerender({ impactCue: cue(4) });
    expect(result.current.pulse?.sequence).toBe(4);

    rerender({ impactCue: cue(5) });
    expect(result.current.pulse?.sequence).toBe(5);
  });

  it("clears an active pulse when presentation resets", () => {
    const { result, rerender } = renderHook(
      ({ impactCue }: { impactCue: ReturnType<typeof cue> | null }) => useImpactPulse(impactCue),
      {
        initialProps: { impactCue: cue(4) as ReturnType<typeof cue> | null },
      },
    );

    rerender({ impactCue: cue(5) });
    expect(result.current.pulse?.sequence).toBe(5);

    rerender({ impactCue: null });
    expect(result.current.pulse).toBeNull();
  });
});
