// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { animateParticleLoop } from "@/lib/animation/particle-loop";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("animateParticleLoop", () => {
  it("cancels the pending frame and does not call onComplete after stop", () => {
    const rafCbs: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCbs.push(cb);
      return rafCbs.length;
    });
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const onComplete = vi.fn();
    const ctx = { clearRect: vi.fn() } as unknown as CanvasRenderingContext2D;

    const stop = animateParticleLoop({
      ctx,
      particles: [{ n: 1 }],
      width: 10,
      height: 10,
      duration: 1000,
      step: vi.fn(),
      draw: vi.fn(),
      onComplete,
    });

    expect(rafCbs).toHaveLength(1);
    stop();
    expect(cancelSpy).toHaveBeenCalledWith(1);
    rafCbs[0]?.(performance.now() + 2000);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
