/** TrueType cmap coverage check for the deliberately small Chinese QA font. */
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

export function missingChineseGlyphs(bytes, text) {
  return [...new Set(text.match(/[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/gu) ?? [])].filter(
    (character) => !fontHasGlyph(bytes, character.codePointAt(0)),
  );
}
