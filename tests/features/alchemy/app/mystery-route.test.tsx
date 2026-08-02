// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { runLoopScreenRoutes } from "@/app/screen-routes/run-loop-routes";

const continueSpy = vi.fn();

vi.mock("@/features/alchemy/shared/stores/use-run-screen-data", () => ({
  useAlchemistScreenData: vi.fn(),
  useCampfireScreenData: vi.fn(),
  useCorruptionScreenData: vi.fn(),
  useDestinationScreenData: vi.fn(),
  useEquipmentShopScreenData: vi.fn(),
  useLabyrinthMapScreenData: vi.fn(),
  useMysteryScreenData: () => ({ runDeck: [], mysteryEvent: null, mysteryCardChoices: null }),
  useRewardsScreenData: vi.fn(),
  useShopScreenData: vi.fn(),
  useTrinketShopScreenData: vi.fn(),
  useWildwoodRecoveryScreenData: vi.fn(),
  useWildwoodRemovalScreenData: vi.fn(),
}));

vi.mock("@/features/alchemy/run-loop/screens", () => {
  const Screen = () => null;
  return {
    AlchemistShopScreen: Screen,
    BattleScreen: Screen,
    CampfireScreen: Screen,
    CorruptionScreen: Screen,
    DestinationScreen: Screen,
    EquipmentShopScreen: Screen,
    LabyrinthMapScreen: Screen,
    MerchantShopScreen: Screen,
    MysteryScreen: Screen,
    RewardsScreen: Screen,
    TrinketShopScreen: Screen,
    WildwoodRecoveryScreen: Screen,
    WildwoodRemovalScreen: Screen,
  };
});

vi.mock("@/features/alchemy/shared/stores/run-session-react-ports", () => ({
  useIsWildwoodRun: () => false,
  useTalentEffects: () => ({}),
}));

afterEach(() => {
  cleanup();
  continueSpy.mockClear();
});

function routeElement() {
  return runLoopScreenRoutes.mystery?.({
    routeCommands: {
      runLoop: {
        mystery: {
          handleContinue: () => continueSpy(),
          handleChoice: vi.fn(),
          handleChooseCard: vi.fn(),
          handleRemoveCard: vi.fn(),
        },
      },
    },
    onOpenBattleMenu: vi.fn(),
  } as never);
}

describe("MysteryScreenRoute", () => {
  it("does not auto-continue twice when command identities change during recovery", () => {
    const view = render(routeElement());
    expect(continueSpy).toHaveBeenCalledOnce();

    view.rerender(routeElement());

    expect(continueSpy).toHaveBeenCalledOnce();
  });
});
