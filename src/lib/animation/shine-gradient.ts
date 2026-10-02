const SHINE_TEXT_HIGHLIGHT = "#ffffff";

// Single neutral shine fallback shared by borders, gear, and keyword
// palettes. Previously three identical copies drifted independently.
export const NEUTRAL_SHINE_FALLBACK = ["#cbd5e1", "#64748b", "#cbd5e1"] as const;

// Repeated palettes occur across card titles and tooltips. Bound transient
// palettes too, so dynamic callers cannot grow retained strings indefinitely.
const MAX_GRADIENT_CACHE_ENTRIES = 128;
const MAX_CACHED_PALETTE_LENGTH = 1024;
const gradientCache = new Map<string, string>();

export function buildSmoothShineGradient(colors: readonly string[]): string | null {
  if (colors.length === 0) return null;
  const palette = colors.join(", ");
  // The first stop closes the loop; include its boundary when colors contain commas.
  const cacheKey = `${colors[0]?.length}:${palette}`;
  const cached = gradientCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const band = `${palette}, ${SHINE_TEXT_HIGHLIGHT}`;
  const gradient = `linear-gradient(in oklab 90deg, ${band}, ${band}, ${colors[0] ?? ""})`;
  if (palette.length <= MAX_CACHED_PALETTE_LENGTH) {
    if (gradientCache.size >= MAX_GRADIENT_CACHE_ENTRIES) {
      const oldest = gradientCache.keys().next().value;
      if (oldest !== undefined) gradientCache.delete(oldest);
    }
    gradientCache.set(cacheKey, gradient);
  }
  return gradient;
}
