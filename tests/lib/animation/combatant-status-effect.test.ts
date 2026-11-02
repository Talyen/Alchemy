import { describe, expect, it, vi } from "vitest";
import {
  combatantStatusPalette,
  combatantStatusProgress,
  combatantStatusWobbleDegrees,
  drawCombatantStatusEffect,
  drawCombatantStatusEffectStatic,
} from "@/lib/animation/combatant-status-effect";
import { COMBATANT_STATUS_EFFECT_PHASE_MS } from "@/lib/game-constants";

function createMockContext(): CanvasRenderingContext2D {
  const gradient = {
    addColorStop: vi.fn(),
  };

  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn().mockReturnValue(gradient),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe("combatantStatusPalette", () => {
  it("computes and caches palette for stun and freeze", () => {
    const stunPalette = combatantStatusPalette("stun");
    expect(stunPalette.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(stunPalette.secondary).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(stunPalette.primaryRgb).toHaveLength(3);
    expect(stunPalette.secondaryRgb).toHaveLength(3);
    expect(stunPalette.glowRgb).toHaveLength(3);

    // Verifies cache returns the same object reference
    expect(combatantStatusPalette("stun")).toBe(stunPalette);

    const freezePalette = combatantStatusPalette("freeze");
    expect(freezePalette.primary).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(combatantStatusPalette("freeze")).toBe(freezePalette);
  });
});

describe("combatantStatusProgress", () => {
  it("normalizes elapsed time by phase duration", () => {
    expect(combatantStatusProgress(0)).toBe(0);
    expect(combatantStatusProgress(COMBATANT_STATUS_EFFECT_PHASE_MS * 0.5)).toBeCloseTo(0.5);
    expect(combatantStatusProgress(COMBATANT_STATUS_EFFECT_PHASE_MS)).toBe(1);
  });
});

describe("combatantStatusWobbleDegrees", () => {
  it("returns 0 for freeze", () => {
    expect(combatantStatusWobbleDegrees("freeze", 0.5)).toBe(0);
  });

  it("suppresses wobble when appear threshold has not been reached", () => {
    expect(combatantStatusWobbleDegrees("stun", 0.001)).toBe(0);
  });

  it("returns sinusoidal wobble during stun", () => {
    const wobbleQuarter = combatantStatusWobbleDegrees("stun", 0.25);
    expect(wobbleQuarter).toBeCloseTo(2.2);

    const wobbleThreeQuarters = combatantStatusWobbleDegrees("stun", 0.75);
    expect(wobbleThreeQuarters).toBeCloseTo(-2.2);
  });
});

describe("drawCombatantStatusEffectStatic", () => {
  it("paints a translucent backdrop and resets globalAlpha", () => {
    const ctx = createMockContext();
    const palette = combatantStatusPalette("stun");

    drawCombatantStatusEffectStatic(ctx, 100, 150, "stun", palette);

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 150);
    expect(ctx.fillStyle).toBe(palette.primary);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 150);
    expect(ctx.globalAlpha).toBe(1);

    drawCombatantStatusEffectStatic(ctx, 100, 150, "freeze", palette);
    expect(ctx.globalAlpha).toBe(1);
  });
});

describe("drawCombatantStatusEffect", () => {
  it("clears without drawing particles when progress is near zero for stun", () => {
    const ctx = createMockContext();
    const palette = combatantStatusPalette("stun");

    drawCombatantStatusEffect(ctx, 100, 100, "stun", 0, palette);

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("draws swirling stars and restores globalAlpha for stun", () => {
    const ctx = createMockContext();
    const palette = combatantStatusPalette("stun");

    drawCombatantStatusEffect(ctx, 100, 100, "stun", 0.5, palette);

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
    expect(ctx.fillStyle).toBe(palette.primary);
    expect(ctx.strokeStyle).toBe(palette.secondary);
    expect(ctx.lineWidth).toBe(0.6);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(1);
  });

  it("draws radial frost and snowflakes for freeze", () => {
    const ctx = createMockContext();
    const palette = combatantStatusPalette("freeze");

    drawCombatantStatusEffect(ctx, 100, 100, "freeze", 0.5, palette);

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
    expect(ctx.fillStyle).toBe(palette.primary);
    expect(ctx.strokeStyle).toBe(palette.secondary);
    expect(ctx.lineWidth).toBe(0.65);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(1);
  });
});
