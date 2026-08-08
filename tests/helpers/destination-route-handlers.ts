import { vi } from "vitest";
import type { DestinationRouteDeps } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import type { RewardRouteDeps } from "@/features/alchemy/run-loop/navigation/reward-flow-types";

export function makeDestinationRouteDeps(): DestinationRouteDeps {
  return {
    navigateTo: vi.fn(),
    beginMysteryEvent: vi.fn(),
    initializeShop: vi.fn(),
    startBattle: vi.fn(),
    startBoss: vi.fn(),
    resetCorruption: vi.fn(),
  };
}

export function makeRewardRouteDeps(): RewardRouteDeps {
  return {
    navigateTo: vi.fn(),
    completeRunVictory: vi.fn(),
    handleActComplete: vi.fn(),
    labyrinthClearNode: vi.fn(),
    setCompanionRewardCards: vi.fn(),
    setRewardState: vi.fn(),
  };
}
