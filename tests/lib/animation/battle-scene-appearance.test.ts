import { describe, expect, it } from "vitest";

import {
  deriveBattleSceneAppearance,
  deriveBattleSceneLighting,
  NEUTRAL_BATTLE_SCENE_LIGHTING,
  NEUTRAL_BATTLE_SCENE_APPEARANCE,
} from "@/lib/animation/battle-scene-appearance";

function pixels(rgb: readonly number[], count = 100) {
  return Array.from({ length: count }, () => [...rgb, 255]).flat();
}

describe("universal board appearance", () => {
  it("bounds tint and shadow strength even for saturated boards", () => {
    for (const rgb of [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [240, 180, 20],
      [20, 160, 240],
    ]) {
      const appearance = deriveBattleSceneAppearance(pixels(rgb));
      expect(appearance.ambientOpacity).toBeGreaterThanOrEqual(0);
      expect(appearance.ambientOpacity).toBeLessThanOrEqual(0.06);
      expect(Math.max(...appearance.ambientColor) - Math.min(...appearance.ambientColor)).toBeLessThanOrEqual(36);
      expect(appearance.shadowOpacity).toBeGreaterThanOrEqual(0.26);
      expect(appearance.shadowOpacity).toBeLessThanOrEqual(0.38);
      expect(appearance.artworkExposure).toBeGreaterThanOrEqual(0.94);
      expect(appearance.artworkExposure).toBeLessThanOrEqual(1.03);
      expect(appearance.shadeOpacity).toBeGreaterThanOrEqual(0);
      expect(appearance.shadeOpacity).toBeLessThanOrEqual(0.08);
    }
  });

  it("adapts hue and shadow strength without tinting neutral boards", () => {
    const warm = deriveBattleSceneAppearance(pixels([180, 110, 60]));
    const cool = deriveBattleSceneAppearance(pixels([60, 110, 180]));
    expect(warm.ambientColor[0]).toBeGreaterThan(warm.ambientColor[2]);
    expect(cool.ambientColor[2]).toBeGreaterThan(cool.ambientColor[0]);
    expect(deriveBattleSceneAppearance(pixels([180, 180, 180])).ambientOpacity).toBe(0);
    const dark = deriveBattleSceneAppearance(pixels([40, 40, 40]));
    const bright = deriveBattleSceneAppearance(pixels([220, 220, 220]));
    expect(dark.artworkExposure).toBeLessThan(bright.artworkExposure);
    expect(dark.shadeOpacity).toBeGreaterThan(bright.shadeOpacity);
    expect(deriveBattleSceneAppearance(pixels([200, 200, 200])).shadowOpacity).toBeGreaterThan(
      deriveBattleSceneAppearance(pixels([40, 40, 40])).shadowOpacity,
    );
  });

  it("rejects empty, transparent, invalid, and extreme pixels", () => {
    for (const input of [[], [255, 0, 0, 0], [NaN, 100, 100, 255], pixels([0, 0, 0]), pixels([255, 255, 255])]) {
      expect(deriveBattleSceneAppearance(input)).toEqual(NEUTRAL_BATTLE_SCENE_APPEARANCE);
    }
  });

  it("trims isolated highlights and dark details instead of letting them shift the scene", () => {
    const base = pixels([100, 120, 140], 80);
    const noisy = [...base, ...pixels([20, 20, 20], 10), ...pixels([230, 230, 230], 10)];
    const actual = deriveBattleSceneAppearance(noisy);
    const expected = deriveBattleSceneAppearance(base);
    expect(actual.ambientColor).toEqual(expected.ambientColor);
    expect(actual.ambientOpacity).toBe(expected.ambientOpacity);
    expect(actual.shadowOpacity).toBeCloseTo(expected.shadowOpacity, 12);
    expect(actual.artworkExposure).toBeCloseTo(expected.artworkExposure, 12);
    expect(actual.shadeOpacity).toBeCloseTo(expected.shadeOpacity, 12);
  });
});

describe("regional board lighting", () => {
  it("keeps opposing board colors distinct while bounding every regional tint", () => {
    const input = Array.from({ length: 20 }, (_, y) =>
      Array.from({ length: 32 }, (_, x) =>
        y >= 11 ? [90, 155, 90, 255] : x < 16 ? [220, 80, 30, 255] : [30, 80, 220, 255],
      ).flat(),
    ).flat();
    const result = deriveBattleSceneLighting(input, 32, 20);
    expect(result.regions.left.ambientColor[0]).toBeGreaterThan(result.regions.right.ambientColor[0]);
    expect(result.regions.right.ambientColor[2]).toBeGreaterThan(result.regions.left.ambientColor[2]);
    expect(result.regions.lower.ambientColor[1]).toBeGreaterThan(result.regions.lower.ambientColor[0]);
    expect(result.regions.left.artworkExposure).toBeGreaterThan(result.regions.right.artworkExposure);
    expect(result.regions.left.shadeOpacity).toBeLessThan(result.regions.right.shadeOpacity);
    for (const region of Object.values(result.regions)) {
      expect(region.ambientOpacity).toBeLessThanOrEqual(0.06);
      expect(Math.max(...region.ambientColor) - Math.min(...region.ambientColor)).toBeLessThanOrEqual(36);
      expect(region.shadowOpacity).toBe(result.shadowOpacity);
      expect(region.artworkExposure).toBeGreaterThanOrEqual(0.94);
      expect(region.artworkExposure).toBeLessThanOrEqual(1.03);
      expect(region.shadeOpacity).toBeLessThanOrEqual(0.08);
    }
  });

  it("enforces the color limit after regional interpolation and rounding", () => {
    const colors = [
      [126, 197, 96, 255],
      [63, 146, 201, 255],
      [148, 227, 230, 255],
      [13, 8, 199, 255],
    ];
    const input = Array.from(
      { length: 64 },
      (_, index) => colors[(index % 8 < 4 ? 0 : 1) + (index < 32 ? 0 : 2)]!,
    ).flat();
    const result = deriveBattleSceneLighting(input, 8, 8);
    for (const region of Object.values(result.regions)) {
      expect(Math.max(...region.ambientColor) - Math.min(...region.ambientColor)).toBeLessThanOrEqual(36);
    }
  });

  it("uses the whole-board fallback for an extreme region and neutral for malformed samples", () => {
    const input = Array.from({ length: 20 }, () =>
      Array.from({ length: 32 }, (_, x) => (x < 18 ? [0, 0, 0, 255] : [80, 110, 160, 255])).flat(),
    ).flat();
    const result = deriveBattleSceneLighting(input, 32, 20);
    expect(result.regions.left.ambientColor).toEqual(result.ambientColor);
    expect(result.regions.left.ambientOpacity).toEqual(result.ambientOpacity);
    for (const [width, height] of [
      [0, 0],
      [32, 19],
      [NaN, 20],
      [2.5, 20],
    ]) {
      expect(deriveBattleSceneLighting(input, width!, height!)).toEqual(NEUTRAL_BATTLE_SCENE_LIGHTING);
    }
    expect(deriveBattleSceneLighting(pixels([255, 255, 255], 640), 32, 20)).toEqual(NEUTRAL_BATTLE_SCENE_LIGHTING);
  });
});
