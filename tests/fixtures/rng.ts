import { createRunStreamRng } from "@/lib/rng";

export const LCG_MULTIPLIER = 1664525;
export const LCG_INCREMENT = 1013904223;

export function seededRng(seed = 42): () => number {
  return createRunStreamRng(seed, "world");
}
