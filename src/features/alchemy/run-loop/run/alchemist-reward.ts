import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import type { RunTransaction } from "@/features/alchemy/shared/stores/run-session-command";
import { getRandomPotionCard } from "../navigation/reward-flow";

export function applyAlchemistPotion({ draft, rng }: { draft: RunTransaction; rng: () => number }) {
  const potion = getRandomPotionCard(rng);
  if (!potion) return;
  appendCardToRunWithDiscovery(draft, potion);
}
