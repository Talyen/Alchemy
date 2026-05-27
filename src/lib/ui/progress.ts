// Shared progress-meter math for React progress components.
// Depends on no runtime libraries.
// Used by UI primitives and game-specific display elements to keep widths safe.

const PROGRESS_CONFIG = {
  minPercent: 0,
  maxPercent: 100,
} as const;

// Clamp progress input before it reaches CSS so bad game state cannot render invalid widths.
export function clampProgressPercent(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return PROGRESS_CONFIG.minPercent;
  return Math.min(PROGRESS_CONFIG.maxPercent, Math.max(PROGRESS_CONFIG.minPercent, value));
}
