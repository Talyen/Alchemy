import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  fontHasGlyph,
  missingGlyphs,
  requiredFontText,
  FONT_REQUIREMENTS,
} from "../../../scripts/localization/font.mjs";

it("detects unsupported glyphs rather than accepting a font that renders replacement boxes", () => {
  const font = readFileSync(new URL("../../../public/fonts/noto-sans-sc.ttf", import.meta.url));
  expect(missingGlyphs(font, "生命，格挡。简体中文", /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/gu)).toEqual([]);
  expect(fontHasGlyph(font, 0x20000)).toBe(false);
});

it("includes compact-number units in required and bundled script coverage without catalog entries", () => {
  for (const requirement of FONT_REQUIREMENTS) {
    const text = requiredFontText({}, {}, requirement);
    if (requirement.locale === "zh-Hans") expect(text).toContain("亿");
    else if (requirement.locale === "ja") expect(text).toContain("万");
    else expect(text).toContain("т");
    const font = readFileSync(new URL(`../../../public/fonts/${requirement.file}`, import.meta.url));
    expect(missingGlyphs(font, text, requirement.pattern)).toEqual([]);
  }
});

it("qualifies native names with their own script font instead of requiring Japanese glyphs for simplified Chinese", () => {
  const languages = { ja: { name: "日本語" }, "zh-Hans": { name: "简体中文" } };
  for (const requirement of FONT_REQUIREMENTS.filter(({ locale }) => locale === "ja" || locale === "zh-Hans")) {
    const text = requiredFontText({}, languages, requirement);
    const font = readFileSync(new URL(`../../../public/fonts/${requirement.file}`, import.meta.url));
    for (const character of languages[requirement.locale as keyof typeof languages].name)
      expect(text).toContain(character);
    expect(missingGlyphs(font, text, requirement.pattern)).toEqual([]);
    if (requirement.locale === "ja") expect(text).not.toContain("简");
  }
});
