import { describe, expect, it } from "vitest";

import {
  getBossById,
  getBossShineColors,
  getBossShineGradient,
  SHINE_PALETTES,
} from "@/features/alchemy/shared/config";
import { keywordDefinitions, type BestiaryEntry } from "@/lib/game-data";

function makeBoss(overrides: Partial<BestiaryEntry> = {}): BestiaryEntry {
  return {
    id: "test-boss",
    title: "Test Boss",
    subtitle: "",
    descriptionLines: [],
    art: "",
    enemyType: "boss",
    traits: [],
    attackEffects: [],
    ...overrides,
  };
}

describe("getBossShineColors", () => {
  it("collects keyword shine colors from boss traits and attack effects", () => {
    const frostwarden = getBossById("frostwarden");
    expect(frostwarden).toBeDefined();

    const colors = getBossShineColors(frostwarden!);

    expect(colors).toContain(keywordDefinitions.freeze.shineColors[0]);
    expect(colors).toContain(keywordDefinitions.burn.shineColors[0]);
    expect(colors).toContain(keywordDefinitions.physical.shineColors[0]);
  });

  it("falls back when no combat keywords match", () => {
    const colors = getBossShineColors(makeBoss());
    expect(colors).toEqual([...SHINE_PALETTES.bossVictoryFallback]);
  });
});

describe("getBossShineGradient", () => {
  it("builds a 60deg linear gradient from boss shine colors", () => {
    const boss = makeBoss();
    const gradient = getBossShineGradient(boss);

    expect(gradient).toBe(`linear-gradient(60deg, ${SHINE_PALETTES.bossVictoryFallback.join(",")})`);
  });
});
