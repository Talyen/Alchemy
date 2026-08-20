// Shared LCG constants for Playwright E2E seeding of Math.random (run seeds / cosmetics).
import { createRunStreamRng } from "@/lib/run-rng";

export const LCG_MULTIPLIER = 1664525;
export const LCG_INCREMENT = 1013904223;

/** Seeded PRNG for battle unit tests — same algorithm as the persisted `world` stream. */
export function seededRng(seed = 42): () => number {
  return createRunStreamRng(seed, "world");
}
