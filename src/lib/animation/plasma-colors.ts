export interface PlasmaColorPair {
  primary: string;
  secondary: string;
}

export type RgbTuple = readonly [number, number, number];

const HEX_PATTERN = /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHexRgbBytes(
  hex: string,
  fallback: readonly [number, number, number] = [255, 255, 255],
): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, "");
  if (!HEX_PATTERN.test(normalized)) return [...fallback];
  const expanded = normalized.length === 3 ? normalized.replace(/./g, "$&$&") : normalized;
  return [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ];
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
  target: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  target[0] = from[0] + (to[0] - from[0]) * t;
  target[1] = from[1] + (to[1] - from[1]) * t;
  target[2] = from[2] + (to[2] - from[2]) * t;
  return target;
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
