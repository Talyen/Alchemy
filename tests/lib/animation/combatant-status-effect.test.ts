import { describe, expect, it, vi } from "vitest";
import {
  combatantStatusPalette,
  combatantStatusProgress,
  combatantStatusWobbleDegrees,
  drawCombatantStatusEffect,
  drawCombatantStatusEffectStatic,
} from "@/lib/animation/combatant-status-effect";

function createMockContext(): CanvasRenderingContext2D {
  const gradient = {
    addColorStop: vi.fn(),
  };
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe("combatant-status-effect", () => {
  describe("combatantStatusPalette", () => {
    it("derives valid primary, secondary, and glow RGB triplets from keyword", () => {
      const stunPalette = combatantStatusPalette("stun");
      expect(stunPalette.primaryRgb).toHaveLength(3);
      expect(stunPalette.secondaryRgb).toHaveLength(3);
      expect(stunPalette.glowRgb).toHaveLength(3);
      expect(stunPalette.primaryRgb.every((c) => c >= 0 && c <= 255)).toBe(true);

      const freezePalette = combatantStatusPalette("freeze");
      expect(freezePalette.primaryRgb).toHaveLength(3);
      expect(freezePalette.secondaryRgb).toHaveLength(3);
    });
  });

  describe("combatantStatusProgress", () => {
    it("scales elapsed time against phase duration", () => {
      expect(combatantStatusProgress(0)).toBe(0);
      expect(combatantStatusProgress(1000)).toBeGreaterThan(0);
    });
  });

  describe("combatantStatusWobbleDegrees", () => {
    it("returns 0 for freeze", () => {
      expect(combatantStatusWobbleDegrees("freeze", 0.5)).toBe(0);
    });

    it("returns 0 for stun at progress 0 and oscillates during active progress", () => {
      expect(combatantStatusWobbleDegrees("stun", 0)).toBe(0);
      const wobble = combatantStatusWobbleDegrees("stun", 0.25);
      expect(Math.abs(wobble)).toBeGreaterThan(0);
    });
  });

  describe("drawCombatantStatusEffect", () => {
    it("draws swirling stars for stun", () => {
      const ctx = createMockContext();
      const palette = combatantStatusPalette("stun");
      drawCombatantStatusEffect(ctx, 100, 100, "stun", 0.5, palette);

      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it("draws radial gradient and snowflake crystals for freeze", () => {
      const ctx = createMockContext();
      const palette = combatantStatusPalette("freeze");
      drawCombatantStatusEffect(ctx, 100, 100, "freeze", 0.8, palette);

      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 100);
      expect(ctx.createRadialGradient).toHaveBeenCalled();
      expect(ctx.fillRect).toHaveBeenCalled();
      expect(ctx.beginPath).toHaveBeenCalled();
    });
  });

  describe("drawCombatantStatusEffectStatic", () => {
    it("renders fallback rect fill for reduced motion", () => {
      const ctx = createMockContext();
      const palette = combatantStatusPalette("stun");
      drawCombatantStatusEffectStatic(ctx, 80, 120, "stun", palette);

      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 80, 120);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 80, 120);
    });
  });
});
