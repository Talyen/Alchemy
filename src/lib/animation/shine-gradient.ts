const SHINE_TEXT_HIGHLIGHT = "#ffffff";

// Single neutral shine fallback shared by borders, gear, and keyword
// palettes. Previously three identical copies drifted independently.
export const NEUTRAL_SHINE_FALLBACK = ["#cbd5e1", "#64748b", "#cbd5e1"] as const;

export function buildSmoothShineGradient(colors: readonly string[]): string | null {
  if (colors.length === 0) return null;
  const band = [...colors, SHINE_TEXT_HIGHLIGHT];
  const looped = [...band, ...band, band[0]];
  return `linear-gradient(in oklab 90deg, ${looped.join(", ")})`;
}
