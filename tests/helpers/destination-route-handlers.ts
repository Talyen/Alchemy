import { vi } from "vitest";
import type { DestinationRouteHandlers } from "@/features/alchemy/run-loop/run/run-destination-handlers";

export function makeDestinationRouteHandlers(): DestinationRouteHandlers {
  return {
    navigateTo: vi.fn(),
    beginMysteryEvent: vi.fn(),
    resetCorruption: vi.fn(),
    startShop: vi.fn(),
    startAlchemist: vi.fn(),
    startTrinketShop: vi.fn(),
    startEquipmentShop: vi.fn(),
    startBattle: vi.fn(),
    startBossBattle: vi.fn(),
  };
}

export function makeRewardRouteHandlers() {
  return {
    navigateTo: vi.fn(),
    completeRunVictory: vi.fn(),
    handleActComplete: vi.fn(),
    onLabyrinthClearNode: vi.fn(),
    setCompanionRewardCards: vi.fn(),
    setRewardState: vi.fn(),
  };
}
