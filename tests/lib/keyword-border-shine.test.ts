import { describe, expect, it } from "vitest";

import { keywordDefinitions } from "@/lib/game-data";
import { getKeywordBorderShineColors } from "@/lib/keyword-border-shine";

describe("getKeywordBorderShineColors", () => {
  it("returns an empty array when given no keywords", () => {
    expect(getKeywordBorderShineColors([])).toEqual([]);
  });

  it("returns full 3-stop pulse for a single keyword", () => {
    const colors = getKeywordBorderShineColors(["burn"]);
    expect(colors).toEqual([...keywordDefinitions.burn.shineColors]);
    expect(colors).toHaveLength(3);
  });

  it("normalizes two keywords to a 3-stop loop using primary accent colors", () => {
    const colors = getKeywordBorderShineColors(["burn", "freeze"]);
    const burnPrimary = keywordDefinitions.burn.shineColors[0]!;
    const freezePrimary = keywordDefinitions.freeze.shineColors[0]!;

    expect(colors).toEqual([burnPrimary, freezePrimary, burnPrimary]);
    expect(colors).toHaveLength(3);
  });

  it("normalizes three keywords to a 4-stop loop using primary accent colors", () => {
    const colors = getKeywordBorderShineColors(["burn", "freeze", "poison"]);
    const burnPrimary = keywordDefinitions.burn.shineColors[0]!;
    const freezePrimary = keywordDefinitions.freeze.shineColors[0]!;
    const poisonPrimary = keywordDefinitions.poison.shineColors[0]!;

    expect(colors).toEqual([burnPrimary, freezePrimary, poisonPrimary, burnPrimary]);
    expect(colors).toHaveLength(4);
  });

  it("normalizes four keywords to a 5-stop loop without dropping keywords", () => {
    const colors = getKeywordBorderShineColors(["burn", "freeze", "poison", "bleed"]);
    const burnPrimary = keywordDefinitions.burn.shineColors[0]!;
    const freezePrimary = keywordDefinitions.freeze.shineColors[0]!;
    const poisonPrimary = keywordDefinitions.poison.shineColors[0]!;
    const bleedPrimary = keywordDefinitions.bleed.shineColors[0]!;

    expect(colors).toEqual([burnPrimary, freezePrimary, poisonPrimary, bleedPrimary, burnPrimary]);
    expect(colors).toHaveLength(5);
  });

  it("deduplicates repeated keywords without creating extra stops", () => {
    const colors = getKeywordBorderShineColors(["burn", "burn", "freeze", "freeze"]);
    const burnPrimary = keywordDefinitions.burn.shineColors[0]!;
    const freezePrimary = keywordDefinitions.freeze.shineColors[0]!;

    expect(colors).toEqual([burnPrimary, freezePrimary, burnPrimary]);
  });
});
