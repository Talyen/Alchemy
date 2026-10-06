import { vi } from "vitest";
import type { RewardRouteDeps } from "@/features/alchemy/run-loop/run/run-flow-rewards";

export function makeRewardRouteDeps(): RewardRouteDeps {
  return {
    navigateTo: vi.fn(),
    completeRunVictory: vi.fn(),
    handleActComplete: vi.fn(),
    labyrinthClearNode: vi.fn(),
    releaseClaim: vi.fn(),
  };
}
