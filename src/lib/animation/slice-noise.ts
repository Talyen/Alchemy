// Deterministic 0…1 hash used by Slice crack vertices and spark layouts.
// Matches Trinket's CombatantCardEffectNoise so layouts stay stable across frames.

export function sliceEffectNoise(index: number, salt: number): number {
  const n = Math.sin(index * 12989 + salt * 78433) * 43758.5453;
  return n - Math.floor(n);
}
