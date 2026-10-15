export function fontHasGlyph(bytes: Buffer, codePoint: number): boolean;
export function missingGlyphs(bytes: Buffer, text: string, pattern: RegExp): string[];
export const FONTTOOLS_VERSION: string;
export interface FontRequirement {
  locale: string;
  file: string;
  pattern: RegExp;
  url: string;
  sha256: string;
}
export const FONT_REQUIREMENTS: FontRequirement[];
export function requiredFontText(
  catalogs: Record<string, Record<string, string>>,
  languages: Record<string, { name: string }>,
  requirement: FontRequirement,
): string;
