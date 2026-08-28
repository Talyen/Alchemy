export interface PlasmaColorPair {
  primary: string;
  secondary: string;
}

export function parsePlasmaHexColor(hex: string): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, "");
  if (normalized.length === 3) {
    const r = Number.parseInt(normalized[0]! + normalized[0]!, 16) / 255;
    const g = Number.parseInt(normalized[1]! + normalized[1]!, 16) / 255;
    const b = Number.parseInt(normalized[2]! + normalized[2]!, 16) / 255;
    return [r, g, b];
  }
  if (normalized.length === 6) {
    const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
    const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
    const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;
    return [r, g, b];
  }
  return [0.8, 0.8, 0.8];
}

export function lerpPlasmaColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parsePlasmaHexColor(a);
  const [br, bg, bb] = parsePlasmaHexColor(b);
  const mix = (from: number, to: number) => Math.round((from + (to - from) * t) * 255);
  const r = mix(ar, br);
  const g = mix(ag, bg);
  const bl = mix(ab, bb);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}
