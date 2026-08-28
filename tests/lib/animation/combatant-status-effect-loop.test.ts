import { afterEach, describe, expect, it, vi } from "vitest";

import { startCombatantStatusEffectLoop } from "@/lib/animation/combatant-status-effect-loop";

vi.mock("@/lib/animation/combatant-status-effect", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/animation/combatant-status-effect")>();
  return {
    ...actual,
    drawCombatantStatusEffect: vi.fn(),
    drawCombatantStatusEffectStatic: vi.fn(),
  };
});

function attachCanvas(): HTMLCanvasElement {
  const parent = document.createElement("div");
  Object.defineProperty(parent, "clientWidth", { value: 48, configurable: true });
  Object.defineProperty(parent, "clientHeight", { value: 64, configurable: true });
  const canvas = document.createElement("canvas");
  canvas.getContext = (() =>
    ({
      clearRect: vi.fn(),
      setTransform: vi.fn(),
    }) as unknown as CanvasRenderingContext2D) as unknown as typeof canvas.getContext;
  parent.appendChild(canvas);
  document.body.appendChild(parent);
  return canvas;
}

describe("startCombatantStatusEffectLoop", () => {
  afterEach(() => {
    localStorage.removeItem("alchemy-disable-animations");
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("paints once and does not loop when animations are disabled", () => {
    localStorage.setItem("alchemy-disable-animations", "true");
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    const onFrame = vi.fn();

    const stop = startCombatantStatusEffectLoop({
      canvas: attachCanvas(),
      kind: "stun",
      onFrame,
    });

    expect(raf).not.toHaveBeenCalled();
    expect(onFrame).toHaveBeenCalledWith({ progress: 0, wobbleDegrees: 0 });
    stop();
  });

  it("does not reset canvas size when the parent size is unchanged", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const canvas = attachCanvas();
    const widthSetter = vi.fn();
    Object.defineProperty(canvas, "width", {
      configurable: true,
      get: () => 48,
      set: widthSetter,
    });
    Object.defineProperty(canvas, "height", {
      configurable: true,
      get: () => 64,
      set: vi.fn(),
    });

    const stop = startCombatantStatusEffectLoop({
      canvas,
      kind: "freeze",
      onFrame: vi.fn(),
    });

    expect(widthSetter).toHaveBeenCalledTimes(1);
    frames[0]?.(16);
    expect(widthSetter).toHaveBeenCalledTimes(1);
    stop();
  });
});
