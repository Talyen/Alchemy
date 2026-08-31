const SHINE_TEXT_HIGHLIGHT = "#ffffff";

function buildShineGradient(colors: readonly string[], border: boolean): string | null {
  if (colors.length === 0) return null;
  if (border) {
    if (colors.length === 1) return `linear-gradient(in oklab 90deg, ${colors[0]}, ${colors[0]})`;
    const mirrored = [...colors, ...colors.slice(1, -1).reverse(), colors[0]];
    return `linear-gradient(in oklab 90deg, ${mirrored.join(", ")})`;
  }
  const band = [...colors, SHINE_TEXT_HIGHLIGHT];
  const looped = [...band, ...band, band[0]];
  return `linear-gradient(in oklab 90deg, ${looped.join(", ")})`;
}

export function buildSmoothShineGradient(colors: readonly string[]): string | null {
  return buildShineGradient(colors, false);
}

export function buildSmoothShineBorderGradient(colors: readonly string[]): string | null {
  return buildShineGradient(colors, true);
}
