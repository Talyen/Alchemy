import { describe, expect, it } from "vitest";

import {
  getPlasmaColorPair,
  getPlasmaColorPairForCharacter,
  getPlasmaKeywordsForCharacter,
  lerpPlasmaColor,
} from "@/features/alchemy/shared/config/plasma-palettes";
import { parsePlasmaHexColor } from "@/lib/animation/plasma-colors";
import { WILDCARD_KEYWORD_SHINE_COLORS } from "@/features/alchemy/shared/config";
import { characters, keywordDefinitions } from "@/lib/game-data";

describe("getPlasmaColorPair", () => {
  it("uses first keyword bright stop as primary and second keyword bright stop as secondary", () => {
    expect(getPlasmaColorPair(["block", "armor"])).toEqual({
      primary: keywordDefinitions.block.shineColors[0],
      secondary: keywordDefinitions.armor.shineColors[0],
    });
  });

  it("uses mid stop as secondary when only one keyword is present", () => {
    expect(getPlasmaColorPair(["burn"])).toEqual({
      primary: keywordDefinitions.burn.shineColors[0],
      secondary: keywordDefinitions.burn.shineColors[1],
    });
  });

  it("uses wildcard cycle colors when affinities are empty", () => {
    expect(getPlasmaColorPair([])).toEqual({
      primary: WILDCARD_KEYWORD_SHINE_COLORS[0],
      secondary: WILDCARD_KEYWORD_SHINE_COLORS[1],
    });
  });
});

describe("getPlasmaKeywordsForCharacter", () => {
  it("returns knight affinity keywords in catalog order", () => {
    expect(getPlasmaKeywordsForCharacter("knight")).toEqual(characters.knight.keywords);
  });

  it("returns empty list for wildcard", () => {
    expect(getPlasmaKeywordsForCharacter("wildcard")).toEqual([]);
  });
});

describe("getPlasmaColorPairForCharacter", () => {
  it("maps knight affinities to plasma stops", () => {
    expect(getPlasmaColorPairForCharacter("knight")).toEqual({
      primary: keywordDefinitions.block.shineColors[0],
      secondary: keywordDefinitions.armor.shineColors[0],
    });
  });
});

describe("plasma color utilities", () => {
  it("parses six-digit hex colors", () => {
    expect(parsePlasmaHexColor("#ff8040")).toEqual([1, 128 / 255, 64 / 255]);
  });

  it("lerps between hex colors", () => {
    expect(lerpPlasmaColor("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
