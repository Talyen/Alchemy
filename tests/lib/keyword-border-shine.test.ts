import { expect, it } from "vitest";
import { keywordDefinitions } from "@/lib/game-data";
import { getKeywordBorderShineColors } from "@/lib/keyword-border-shine";

it("preserves a single keyword pulse and closes a deduplicated multi-keyword loop", () => {
  expect(getKeywordBorderShineColors([])).toEqual([]);
  expect(getKeywordBorderShineColors(["burn", "burn"])).toEqual(keywordDefinitions.burn.shineColors);
  const primary = ["burn", "freeze", "poison", "bleed"].map(
    (id) => keywordDefinitions[id as keyof typeof keywordDefinitions].shineColors[0]!,
  );
  expect(getKeywordBorderShineColors(["burn", "freeze", "burn", "poison", "bleed"])).toEqual([...primary, primary[0]]);
  expect(getKeywordBorderShineColors(["nature", "thorns"])).toEqual(keywordDefinitions.nature.shineColors);
});
