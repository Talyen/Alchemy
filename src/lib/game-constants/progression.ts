// Talent XP and unlock presentation tuning.

export const XP_BASE_PER_POINT = 10; // Point n costs n×10 XP (triangular total).
export const XP_TRIANGULAR_MULTIPLIER = 5; // Total XP for n points: n(n+1)/2 × 5.
export const XP_MIN_THRESHOLD = 10;
export const XP_ROOT_DIVISOR = 0.8; // Inverse formula: sqrt(1 + 0.8×XP).
export const TALENT_UNLOCK_ANIMATION_MS = 300;
export const TALENT_UNLOCK_SPARK_COUNT = 16;
