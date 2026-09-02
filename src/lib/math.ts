export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value: number) {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clampNonNegative(value: number): number {
  return Math.max(0, value);
}
