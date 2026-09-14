/**
 * Deterministic pseudo-random hash noise in [0, 1) based on trigonometric fract.
 * Used for reproducible animation jitters, particle distribution, and procedural cracks.
 */
export function animationNoise(index: number, salt: number): number {
  const n = Math.sin(index * 12989 + salt * 78433) * 43758.5453;
  return n - Math.floor(n);
}
