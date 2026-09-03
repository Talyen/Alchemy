export function clamp(value: number, min: number, max: number) {
  if (min > max) throw new Error("clamp requires min <= max");
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
