/** Read bundled TrueType/OpenType cmap coverage without relying on system fallbacks. */
export function fontHasGlyph(bytes, codePoint) {
  let cmap;
  for (let index = 0; index < bytes.readUInt16BE(4); index++) {
    const record = 12 + index * 16;
    if (bytes.toString("ascii", record, record + 4) === "cmap") cmap = bytes.readUInt32BE(record + 8);
  }
  if (cmap === undefined) return false;
  for (let index = 0; index < bytes.readUInt16BE(cmap + 2); index++) {
    const table = cmap + bytes.readUInt32BE(cmap + 8 + index * 8);
    const format = bytes.readUInt16BE(table);
    if (format === 12) {
      for (let group = 0; group < bytes.readUInt32BE(table + 12); group++) {
        const offset = table + 16 + group * 12;
        const start = bytes.readUInt32BE(offset);
        if (codePoint >= start && codePoint <= bytes.readUInt32BE(offset + 4))
          return bytes.readUInt32BE(offset + 8) + codePoint - start !== 0;
      }
    }
    if (format === 4 && codePoint <= 0xffff) {
      const count = bytes.readUInt16BE(table + 6) / 2;
      const ends = table + 14;
      const starts = ends + count * 2 + 2;
      const deltas = starts + count * 2;
      const ranges = deltas + count * 2;
      for (let segment = 0; segment < count; segment++) {
        const start = bytes.readUInt16BE(starts + segment * 2);
        if (codePoint < start || codePoint > bytes.readUInt16BE(ends + segment * 2)) continue;
        const delta = bytes.readInt16BE(deltas + segment * 2);
        const range = bytes.readUInt16BE(ranges + segment * 2);
        if (!range) return ((codePoint + delta) & 0xffff) !== 0;
        const glyph = bytes.readUInt16BE(ranges + segment * 2 + range + (codePoint - start) * 2);
        return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
      }
    }
  }
  return false;
}

export function missingGlyphs(bytes, text, pattern) {
  return [...new Set(text.match(pattern) ?? [])].filter((character) => !fontHasGlyph(bytes, character.codePointAt(0)));
}

// Source digests pin the exact OFL variable fonts used to produce the bundled subsets.
export const FONTTOOLS_VERSION = "4.60.1";
export const FONT_REQUIREMENTS = [
  {
    locale: "ja",
    file: "noto-sans-jp.ttf",
    pattern: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3000-\u303f\uff00-\uffef]/gu,
    url: "https://raw.githubusercontent.com/google/fonts/a85815a42757630ce188fdad368c2dfc444d4773/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf",
    sha256: "c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f",
  },
  {
    locale: "zh-Hans",
    file: "noto-sans-sc.ttf",
    pattern: /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/gu,
    url: "https://raw.githubusercontent.com/google/fonts/a85815a42757630ce188fdad368c2dfc444d4773/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
    sha256: "a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da",
  },
  {
    locale: "ru",
    file: "noto-sans.ttf",
    pattern: /\p{Script=Cyrillic}/gu,
    url: "https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf",
    sha256: "bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d",
  },
];
export function requiredFontText(catalogs, languages, requirement) {
  const amounts = new Intl.NumberFormat(requirement.locale, { notation: "compact", maximumFractionDigits: 1 });
  const text =
    Object.values(catalogs[requirement.locale] ?? {}).join("\n") +
    Array.from({ length: 11 }, (_, index) => amounts.format(10 ** (index + 5))).join("") +
    (languages[requirement.locale]?.name ?? "");
  return [...new Set(text.match(requirement.pattern) ?? [])].sort().join("");
}
