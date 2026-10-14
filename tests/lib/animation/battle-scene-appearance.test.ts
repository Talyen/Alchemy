import { describe, expect, it } from "vitest";

import { deriveBattleSceneAppearance, NEUTRAL_BATTLE_SCENE_APPEARANCE } from "@/lib/animation/battle-scene-appearance";

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
    }
  });

  it("adapts hue and shadow strength without tinting neutral boards", () => {
    const warm = deriveBattleSceneAppearance(pixels([180, 110, 60]));
    const cool = deriveBattleSceneAppearance(pixels([60, 110, 180]));
    expect(warm.ambientColor[0]).toBeGreaterThan(warm.ambientColor[2]);
    expect(cool.ambientColor[2]).toBeGreaterThan(cool.ambientColor[0]);
    expect(deriveBattleSceneAppearance(pixels([180, 180, 180])).ambientOpacity).toBe(0);
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
  });
});
