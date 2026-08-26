import { describe, expect, it } from "vitest";
import { keywordDefinitions } from "@/lib/game-data";
import { gearDefinitions } from "@/lib/gear/definitions";
import {
  getAstralShineColors,
  getGearDefinitionShineColors,
  getGearDefinitionShineGradient,
  getGearInstanceKeywordIds,
  getGearInstanceShineColors,
  getGearInstanceShineGradient,
} from "@/lib/gear/gear-shine";
import type { GearInstance } from "@/lib/gear/types";

function instance(overrides: Partial<GearInstance> & Pick<GearInstance, "instanceId" | "definitionId">): GearInstance {
  return {
    affixes: [],
    ...overrides,
  };
}

describe("gear shine", () => {
  it("collects unique sorted keywords from affixes including secondary keywords", () => {
    const keywordIds = getGearInstanceKeywordIds(
      instance({
        instanceId: "shine-1",
        definitionId: "longsword-astral",
        affixes: [
          { id: "poison-leech", value: 5 },
          { id: "flat-burn", value: 2 },
        ],
      }),
    );

    expect(keywordIds).toEqual(["burn", "leech", "poison"]);
  });

  it("returns no shine colors for basic gear", () => {
    expect(
      getGearInstanceShineColors(
        instance({
          instanceId: "basic-1",
          definitionId: "longsword-basic",
          affixes: [{ id: "flat-burn", value: 2 }],
        }),
      ),
    ).toEqual([]);
    expect(
      getGearInstanceShineGradient(
        instance({
          instanceId: "basic-1",
          definitionId: "longsword-basic",
          affixes: [{ id: "flat-burn", value: 2 }],
        }),
      ),
    ).toBeNull();
  });

  it("builds a stable astral gradient from all affix keywords", () => {
    const gear = instance({
      instanceId: "astral-1",
      definitionId: "longsword-astral",
      affixes: [
        { id: "flat-burn", value: 2 },
        { id: "gold-on-kill", value: 1 },
      ],
    });

    const gradient = getGearInstanceShineGradient(gear);
    expect(gradient).toMatch(/^linear-gradient\(in oklab/);
    expect(gradient).not.toContain("var(--color-foreground)");
    expect(gradient).toContain(keywordDefinitions.burn.shineColors[0]!);
    expect(gradient).toContain(keywordDefinitions.gold.shineColors[0]!);
    expect(getGearInstanceShineGradient(gear)).toBe(gradient);
  });

  it("returns astral shine colors only for astral definitions", () => {
    expect(
      getAstralShineColors(
        instance({
          instanceId: "basic-1",
          definitionId: "longsword-basic",
          affixes: [],
        }),
      ),
    ).toBeUndefined();
    expect(
      getAstralShineColors(
        instance({
          instanceId: "astral-1",
          definitionId: "longsword-astral",
          affixes: [],
        }),
      ),
    ).toEqual(expect.arrayContaining(["#cbd5e1"]));
  });

  it("uses the gold uniqueness palette for unique gear", () => {
    const unique = instance({
      instanceId: "unique-1",
      definitionId: "wardbreaker",
      affixes: [{ id: "flat-stun", value: 4 }],
    });
    const colors = ["#fbbf24", "#f59e0b", "#d97706", "#fef3c7", "#fbbf24"];
    expect(getGearInstanceShineColors(unique)).toEqual(colors);
    expect(getAstralShineColors(unique)).toEqual(colors);
    expect(getGearDefinitionShineColors(gearDefinitions.wardbreaker!)).toEqual(colors);
  });

  it("shines definition-only astral titles from affinity keywords and leaves basic plain", () => {
    expect(getGearDefinitionShineGradient(gearDefinitions["longsword-basic"]!)).toBeNull();
    const astral = getGearDefinitionShineGradient(gearDefinitions["longsword-astral"]!);
    expect(astral).toMatch(/^linear-gradient\(in oklab/);
    expect(astral).toContain(keywordDefinitions.physical.shineColors[0]!);
    expect(astral).toContain(keywordDefinitions.forge.shineColors[0]!);
  });
});
