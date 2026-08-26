const SHINE_TEXT_HIGHLIGHT = "#ffffff";

/** Builds a seamless repeated text gradient with perceptually smooth color interpolation. */
export function buildSmoothShineGradient(colors: readonly string[]): string | null {
  if (colors.length === 0) return null;

  const band = [...colors, SHINE_TEXT_HIGHLIGHT];
  const looped = [...band, ...band, band[0]];
  return `linear-gradient(in oklab 90deg, ${looped.join(", ")})`;
}

/** Builds a mirrored border gradient without the traveling text highlight. */
export function buildSmoothShineBorderGradient(colors: readonly string[]): string | null {
  if (colors.length === 0) return null;
  if (colors.length === 1) return `linear-gradient(in oklab 90deg, ${colors[0]}, ${colors[0]})`;
  const mirrored = [...colors, ...colors.slice(1, -1).reverse(), colors[0]];
  return `linear-gradient(in oklab 90deg, ${mirrored.join(", ")})`;
}
