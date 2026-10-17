import { expect, it, vi } from "vitest";
import { animateHurtSparks, createHurtSparks } from "@/lib/animation/hurt-sparks";
import { animationHarness } from "../../helpers/animation-harness";

it("spawns the requested sparks on vertical portrait edges", () => {
  animationHarness();
  const sparks = createHurtSparks(
    300,
    200,
    10,
    ["red"],
    { x: 50, y: 50, width: 100, height: 100 },
    { edges: "vertical" },
  );
  expect(sparks).toHaveLength(10);
  expect(sparks.every((p) => p.color === "red" && (p.x === 52 || p.x === 148) && p.y >= 52 && p.y <= 148)).toBe(true);
});

it("preserves translucent draw order, batches color writes, and completes after fading", () => {
  const h = animationHarness();
  const sparks = createHurtSparks(100, 100, 4, ["red"]);
  sparks[3]!.color = "blue";
  let color = "";
  const colors: string[] = [],
    draws: string[] = [];
  Object.defineProperty(h.ctx, "fillStyle", {
    get: () => color,
    set: (value: string) => {
      colors.push(value);
      color = value;
    },
  });
  h.ctx.fillRect.mockImplementation(() => {
    draws.push(color);
  });
  const complete = vi.fn();
  h.own(animateHurtSparks(h.ctx as unknown as CanvasRenderingContext2D, sparks, 100, 100, 1000, complete));
  h.frame(500);
  expect(colors).toEqual(["red", "blue"]);
  expect(draws).toEqual(["red", "red", "red", "blue"]);
  expect(sparks.every((p) => p.alpha === 0.75)).toBe(true);
  expect(h.ctx.globalAlpha).toBe(1);
  expect(complete).not.toHaveBeenCalled();
  h.frame(1000);
  expect(sparks.every((p) => p.alpha === 0)).toBe(true);
  expect(h.ctx.globalAlpha).toBe(1);
  expect(complete).toHaveBeenCalledOnce();
  expect(h.pending.size).toBe(0);
});
