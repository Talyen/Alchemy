import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { fontHasGlyph, missingChineseGlyphs } from "../../../scripts/localization/font.mjs";

it("detects unsupported glyphs rather than accepting a font that renders replacement boxes", () => {
  const font = readFileSync(new URL("../../../public/fonts/noto-sans-sc-sample.ttf", import.meta.url));
  expect(missingChineseGlyphs(font, "生命，格挡。简体中文（字体测试）")).toEqual([]);
  expect(fontHasGlyph(font, 0x20000)).toBe(false);
});
