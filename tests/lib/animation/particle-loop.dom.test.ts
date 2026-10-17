import { expect, it, vi } from "vitest";
import { animateParticleLoop } from "@/lib/animation/particle-loop";
import { animationHarness } from "../../helpers/animation-harness";

it.each(["cancel", "complete", "cancel-during-draw"] as const)("particle loop terminates once after %s", (mode) => {
  const h = animationHarness();
  const complete = vi.fn();
  const step = vi.fn();
  const draw = vi.fn(() => {
    if (mode === "cancel-during-draw") stop();
  });
  const stop = h.own(
    animateParticleLoop({
      ctx: h.ctx as unknown as CanvasRenderingContext2D,
      particles: [{ n: 1 }],
      width: 10,
      height: 10,
      duration: 100,
      step,
      draw,
      onComplete: complete,
    }),
  );
  const stale = h.latestFrame;
  if (mode === "cancel") {
    stop();
    stop();
  } else h.frame(mode === "complete" ? 100 : 10);
  const draws = draw.mock.calls.length;
  stale(200);
  expect(draw).toHaveBeenCalledTimes(draws);
  expect(complete).toHaveBeenCalledTimes(mode === "complete" ? 1 : 0);
  expect(h.pending.size).toBe(0);
});
