import { expect, it, vi } from "vitest";
import { startCombatantStatusEffectLoop } from "@/lib/animation/combatant-status-effect-loop";
import { drawCombatantStatusEffect } from "@/lib/animation/combatant-status-effect";
import { animationHarness } from "../../helpers/animation-harness";

vi.mock("@/lib/animation/combatant-status-effect", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/animation/combatant-status-effect")>()),
  drawCombatantStatusEffect: vi.fn(),
}));

it("paints a static status without looping when animations are disabled", () => {
  const h = animationHarness(48, 64);
  localStorage.setItem("alchemy-disable-animations", "true");
  const onFrame = vi.fn();
  h.own(startCombatantStatusEffectLoop({ canvas: h.canvas, kind: "stun", onFrame }));
  expect(h.ctx.fillRect).toHaveBeenCalledWith(0, 0, 48, 64);
  expect(h.pending.size).toBe(0);
  expect(onFrame).toHaveBeenCalledExactlyOnceWith({ progress: 0, wobbleDegrees: 0 });
});

it.each(["stun", "freeze"] as const)("resumes %s after collapse and revokes drawing on disposal", (kind) => {
  const h = animationHarness(0, 0);
  const onFrame = vi.fn();
  const stop = h.own(startCombatantStatusEffectLoop({ canvas: h.canvas, kind, onFrame }));
  expect(onFrame).not.toHaveBeenCalled();
  h.resize(48, 64);
  h.frame(16.67);
  expect(drawCombatantStatusEffect).toHaveBeenLastCalledWith(
    h.ctx,
    48,
    64,
    kind,
    expect.any(Number),
    expect.any(Object),
  );
  h.resize(0, 0);
  h.frame(33.34);
  expect(onFrame).toHaveBeenCalledOnce();
  h.resize(48, 64);
  h.frame(50);
  expect(onFrame).toHaveBeenCalledTimes(2);
  stop();
  h.resize(96, 64);
  expect(h.canvas.width).toBe(48);
  expect(h.pending.size).toBe(0);
});
