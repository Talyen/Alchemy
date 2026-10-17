import { expect, it, vi } from "vitest";
import { startBackgroundParticles } from "@/lib/animation/background-particles";
import { animationHarness } from "../../helpers/animation-harness";

it("draws every dust particle with shared color and restores color state each frame", () => {
  const h = animationHarness(200, 100);
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const setColor = vi.fn();
  Object.defineProperty(h.ctx, "fillStyle", { set: setColor });
  h.own(startBackgroundParticles({ current: h.canvas }, "dust"));
  h.frame(16.67);
  expect(setColor).toHaveBeenCalledExactlyOnceWith("rgba(200, 190, 175, 1)");
  expect(h.ctx.fill).toHaveBeenCalledTimes(20);
  expect(h.ctx.globalAlpha).toBe(0.065);
  h.frame(33.34);
  expect(setColor).toHaveBeenCalledTimes(2);
  expect(h.ctx.fill).toHaveBeenCalledTimes(40);
});

it("waits for visible dimensions, honors count/color/alpha, and stops drawing on disposal", () => {
  const h = animationHarness(0, 0);
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const stop = h.own(startBackgroundParticles({ current: h.canvas }, "embers", ["rgba(255, 0, 0, X)"], 0.5, 7));
  expect(h.pending.size).toBe(0);
  h.resize(200, 100);
  h.frame(16.67);
  expect(h.ctx.fillStyle).toBe("rgba(255, 0, 0, 1)");
  expect(h.ctx.globalAlpha).toBe(0.095);
  expect(h.ctx.arc).toHaveBeenCalledTimes(7);
  const stale = h.latestFrame;
  stop();
  stop();
  stale(33.34);
  expect(h.ctx.arc).toHaveBeenCalledTimes(7);
  expect(h.pending.size).toBe(0);
});

it("keeps 4K high-DPR particles within their pixel budget with the matching transform", () => {
  const h = animationHarness(3840, 2160);
  vi.stubGlobal("devicePixelRatio", 2);
  h.own(startBackgroundParticles({ current: h.canvas }, "embers"));
  expect(h.canvas.width * h.canvas.height).toBeLessThanOrEqual(3_000_000);
  expect(h.ctx.setTransform).toHaveBeenLastCalledWith(h.canvas.width / 3840, 0, 0, h.canvas.height / 2160, 0, 0);
});
