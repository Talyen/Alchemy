export interface PlasmaColorPair {
  primary: string;
  secondary: string;
}

export function parsePlasmaHexColor(hex: string): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(normalized)) {
    const r = Number.parseInt(normalized.charAt(0) + normalized.charAt(0), 16) / 255;
    const g = Number.parseInt(normalized.charAt(1) + normalized.charAt(1), 16) / 255;
    const b = Number.parseInt(normalized.charAt(2) + normalized.charAt(2), 16) / 255;
    return [r, g, b];
  }
  if (/^[0-9a-f]{6}$/i.test(normalized)) {
    const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
    const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
    const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
    return [r, g, b];
  }
  return [0.8, 0.8, 0.8];
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
