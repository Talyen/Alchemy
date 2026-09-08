import { createRunStreamRng } from "@/lib/rng";

export function seededRng(seed = 42): () => number {
  return createRunStreamRng(seed, "world");
}
