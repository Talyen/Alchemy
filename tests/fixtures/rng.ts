import { createRunStreamRng, type Rng } from "@/lib/rng";

export function seededRng(seed = 42): Rng {
  return createRunStreamRng(seed, "world");
}
