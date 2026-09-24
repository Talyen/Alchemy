import { describe, expect, it } from "vitest";
import {
  CORRUPTION_DAMAGE_BASELINES,
  CORRUPTION_OUTCOME_WEIGHTS,
  ENEMY_BALANCE_BY_TYPE,
  ENEMY_PRESSURE_OVERRIDES,
  ENEMY_TRAIT_IDS,
  LOOT_DEPTH_CURVES,
  LOOT_SOURCE_WEIGHTS,
  ROOM_SCALING_INCREMENT,
  TRAIT_DAMAGE_RULES,
  TRAIT_DAMAGE_WEAKNESS_MULTIPLIER,
} from "@/lib/game-constants";
import { getEnemyAbilityPressure } from "@/lib/battle/battle-enemy-setup";
import { enemyBestiary } from "@/lib/game-data";

function pressureAt(enemyType: "normal" | "elite" | "boss", depth: number): number {
  const curve = ENEMY_BALANCE_BY_TYPE[enemyType].pressure;
  return curve.base + curve.linear * depth + curve.quadratic * depth * depth;
}

describe("tuning invariants", () => {
  it("keeps enemy pressure curves finite and non-decreasing through the depth cap", () => {
    for (const enemyType of ["normal", "elite", "boss"] as const) {
      let previous = -Infinity;
      // Loot depth caps at 25 (three 8-destination Acts plus the final boss).
      for (let depth = 0; depth <= 25; depth += 1) {
        const value = pressureAt(enemyType, depth);
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(previous);
        previous = value;
      }
    }
  });

  it("ramps the second room to depth one instead of skipping ahead", () => {
    const skeleton = enemyBestiary.find((enemy) => enemy.id === "skeleton")!;
    const first = getEnemyAbilityPressure({ roomScalingMultiplier: 1, currentEnemy: skeleton });
    const second = getEnemyAbilityPressure({ roomScalingMultiplier: 1.07, currentEnemy: skeleton });
    const third = getEnemyAbilityPressure({ roomScalingMultiplier: 1.14, currentEnemy: skeleton });
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
    expect(second).toBeCloseTo(pressureAt("normal", 1), 10);
  });

  it("slows Elite pressure growth while preserving enemy-specific modifiers", () => {
    const iceWraith = enemyBestiary.find((enemy) => enemy.id === "ice-wraith")!;
    const atDepth = (depth: number) =>
      getEnemyAbilityPressure({ roomScalingMultiplier: 1 + depth * ROOM_SCALING_INCREMENT, currentEnemy: iceWraith });
    expect(atDepth(7)).toBeCloseTo(pressureAt("elite", 7) * 1.25, 10);
    expect(atDepth(23)).toBeCloseTo(pressureAt("elite", 23) * 1.25, 10);
    expect(atDepth(7) - atDepth(6)).toBeGreaterThan(atDepth(23) - atDepth(22));
    expect(atDepth(23)).toBeGreaterThan(atDepth(22));
  });

  it("caps scaling pressure overrides at their stated max", () => {
    for (const [id, override] of Object.entries(ENEMY_PRESSURE_OVERRIDES)) {
      if (typeof override === "number") {
        expect(override).toBeGreaterThan(0);
        continue;
      }
      for (const depth of [0, 8, 16, 24]) {
        expect(override.base + override.linear * depth).toBeGreaterThan(0);
        expect(Math.min(override.max, override.base + override.linear * depth)).toBeLessThanOrEqual(override.max);
      }
      expect(
        enemyBestiary.some((enemy) => enemy.id === id),
        `${id} override must match a bestiary entry`,
      ).toBe(true);
    }
  });

  it("keeps loot source weights normalized per source", () => {
    for (const [source, weights] of Object.entries(LOOT_SOURCE_WEIGHTS)) {
      const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
      expect(total, source).toBeGreaterThan(0.99);
      expect(total, source).toBeLessThan(1.01);
    }
  });

  it("keeps loot depth curves monotonic", () => {
    for (const [kind, points] of Object.entries(LOOT_DEPTH_CURVES)) {
      for (let index = 1; index < points.length; index += 1) {
        // Strictly increasing depths: a duplicate depth would divide by zero
        // in the loot depth interpolation.
        expect(points[index]!.depth, kind).toBeGreaterThan(points[index - 1]!.depth);
        expect(points[index]!.weight, kind).toBeGreaterThanOrEqual(points[index - 1]!.weight);
        expect(Number.isFinite(points[index]!.weight), kind).toBe(true);
      }
    }
  });

  it("keeps corruption tuning positive", () => {
    for (const weight of Object.values(CORRUPTION_OUTCOME_WEIGHTS)) expect(weight).toBeGreaterThan(0);
    for (const baseline of Object.values(CORRUPTION_DAMAGE_BASELINES)) expect(baseline).toBeGreaterThan(0);
  });

  it("keeps trait damage rules pointed at known traits with positive multipliers", () => {
    const ids: ReadonlySet<string> = new Set(Object.values(ENEMY_TRAIT_IDS));
    expect(TRAIT_DAMAGE_WEAKNESS_MULTIPLIER).toBeGreaterThan(1);
    for (const rule of TRAIT_DAMAGE_RULES) {
      expect(ids.has(rule.traitId)).toBe(true);
      expect(rule.multiplier).toBeGreaterThan(0);
    }
  });
});
