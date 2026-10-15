import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { fontHasGlyph, missingGlyphs } from "../../../scripts/localization/font.mjs";

it("detects unsupported glyphs rather than accepting a font that renders replacement boxes", () => {
  const font = readFileSync(new URL("../../../public/fonts/noto-sans-sc.ttf", import.meta.url));
  expect(missingGlyphs(font, "生命，格挡。简体中文", /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/gu)).toEqual([]);
  expect(fontHasGlyph(font, 0x20000)).toBe(false);
});
