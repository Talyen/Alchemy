// Unit tests for labyrinth modifier definitions and depth-based selection.
import { describe, expect, it } from "vitest";
import {
  ALL_LABYRINTH_MODIFIERS,
  getModifiersForRow,
} from "@/lib/content-systems/labyrinth/modifiers";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";

// A deterministic RNG used to make modifier selection predictable.
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe("ALL_LABYRINTH_MODIFIERS", () => {
  it("has exactly 6 modifier kinds", () => {
    const kinds = Object.keys(ALL_LABYRINTH_MODIFIERS);
    expect(kinds).toHaveLength(6);
  });

  it("each modifier has a non-empty label and description", () => {
    for (const mod of Object.values(ALL_LABYRINTH_MODIFIERS)) {
      expect(mod.label.length).toBeGreaterThan(0);
      expect(mod.description.length).toBeGreaterThan(0);
    }
  });
});

describe("getModifiersForRow", () => {
  it("rows 0-1 return 0 or 1 modifier", () => {
    for (let row = 0; row <= 1; row++) {
      for (let trial = 0; trial < 50; trial++) {
        const mods = getModifiersForRow(row, Math.random);
        expect(mods.length).toBeGreaterThanOrEqual(0);
        expect(mods.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("rows 2-3 return exactly 1 modifier (deterministic)", () => {
    // With a deterministic RNG that returns >= 0.5 (so modifierCount always 1),
    // mid rows should return exactly 1 modifier.
    const mods = getModifiersForRow(2, () => 0.75);
    expect(mods).toHaveLength(1);
  });

  it("row 4 returns 1-2 modifiers", () => {
    // With RNG returning 0.0 => count = 1, 0.99 => count = 2.
    const oneMod = getModifiersForRow(4, () => 0.0);
    expect(oneMod.length).toBeGreaterThanOrEqual(1);
    expect(oneMod.length).toBeLessThanOrEqual(2);

    const twoMods = getModifiersForRow(4, () => 0.99);
    expect(twoMods.length).toBe(2);
  });

  it("returned modifier kinds are valid", () => {
    const validKinds = new Set(Object.keys(ALL_LABYRINTH_MODIFIERS));
    for (let row = 0; row < 5; row++) {
      for (let trial = 0; trial < 30; trial++) {
        const mods = getModifiersForRow(row, Math.random);
        for (const m of mods) {
          expect(validKinds.has(m)).toBe(true);
        }
      }
    }
  });

  it("does not return duplicate modifiers", () => {
    for (let trial = 0; trial < 100; trial++) {
      const mods = getModifiersForRow(4, Math.random);
      const unique = new Set(mods);
      expect(unique.size).toBe(mods.length);
    }
  });
});
