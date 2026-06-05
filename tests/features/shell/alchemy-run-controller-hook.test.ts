// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { useAlchemyRunController } from "@/features/alchemy/shell/use-alchemy-run-controller";
import { createEmptyTalentManifest } from "@/lib/game-data";
import {
  resetRunNavigationSlice,
  resetRunProgressSlice,
  setRunProgress,
} from "../../helpers/run-domain-store-test";

vi.mock("@/lib/audio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audio")>();
  return {
    ...actual,
    playGoldGain: vi.fn(),
    playGoldSpend: vi.fn(),
    playUISound: vi.fn(),
    stopAllSfx: vi.fn(),
  };
});

vi.mock("@/lib/platform", () => ({
  platform: {
    isDesktop: false,
    canQuit: false,
    setDisplayMode: vi.fn(),
    quit: vi.fn(),
    steam: { isInitialized: false, playerName: null, init: vi.fn(), setRichPresence: vi.fn() },
    cloud: { isAvailable: false, read: vi.fn(), write: vi.fn() },
  },
}));

beforeEach(() => {
  resetRunProgressSlice();
  setRunProgress({ initialized: true });
  resetRunNavigationSlice();
});

describe("useAlchemyRunController", () => {
  it("exposes screen, run phase, and controller actions after bootstrap", () => {
    const { result } = renderHook(() =>
      useAlchemyRunController({
        discoveredCardIds: [],
        setDiscoveredCardIds: vi.fn(),
        setEncounteredEnemyIds: vi.fn(),
        initialTalentXP: {},
        initialUnlockedTalents: {},
        initialActiveRun: null,
        autoEndTurn: false,
        homesteadEffects: createEmptyTalentManifest(),
        onMarkDifficultyCompleted: vi.fn(),
      }),
    );

    expect(result.current.screen).toBe(ROUTE_SCREENS.MENU);
    expect(result.current.runPhase).toBe("meta");
    expect(typeof result.current.beginCampaign).toBe("function");
    expect(typeof result.current.handleCardClick).toBe("function");
    expect(typeof result.current.resetRunState).toBe("function");
  });
});
