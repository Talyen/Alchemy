export interface PlasmaColorPair {
  primary: string;
  secondary: string;
}

export type RgbTuple = readonly [number, number, number];

const HEX_3_PATTERN = /^[0-9a-f]{3}$/i;
const HEX_6_PATTERN = /^[0-9a-f]{6}$/i;

export function parseHexRgbBytes(
  hex: string,
  fallback: readonly [number, number, number] = [255, 255, 255],
): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, "");
  if (HEX_3_PATTERN.test(normalized)) {
    return [
      Number.parseInt(normalized.charAt(0) + normalized.charAt(0), 16),
      Number.parseInt(normalized.charAt(1) + normalized.charAt(1), 16),
      Number.parseInt(normalized.charAt(2) + normalized.charAt(2), 16),
    ];
  }
  if (HEX_6_PATTERN.test(normalized)) {
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    ];
  }
  return [fallback[0], fallback[1], fallback[2]];
}

export function parseHexRgbNormalized(
  hex: string,
  fallback: readonly [number, number, number] = [0.8, 0.8, 0.8],
): [number, number, number] {
  const bytes = parseHexRgbBytes(hex, [fallback[0] * 255, fallback[1] * 255, fallback[2] * 255]);
  return [bytes[0] / 255, bytes[1] / 255, bytes[2] / 255];
}

export function parsePlasmaHexColor(hex: string): [number, number, number] {
  return parseHexRgbNormalized(hex, [0.8, 0.8, 0.8]);
}

export function lerpParsedRgbFloats(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
}

export function lerpPlasmaColor(a: string, b: string, t: number): string {
  return lerpParsedPlasmaColor(parsePlasmaHexColor(a), parsePlasmaHexColor(b), t);
}

export function lerpParsedPlasmaColor(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): string {
  const mix = (start: number, end: number) => Math.round((start + (end - start) * t) * 255);
  const r = mix(from[0], to[0]);
  const g = mix(from[1], to[1]);
  const b = mix(from[2], to[2]);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
