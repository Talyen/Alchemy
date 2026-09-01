import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { runLoopScreenRoutes } from "@/app/screen-routes/run-loop-routes";
import type { MysteryEvent } from "@/lib/mystery";

const continueSpy = vi.fn();

const mysteryScreenData = vi.hoisted(() => ({
  current: {
    mysteryEvent: null as MysteryEvent | null,
    mysteryCardChoices: null as unknown,
    mysteryGrantedTrinketIds: [] as string[],
    mysteryGrantedGearInstances: [] as unknown[],
    mysteryChosenCardId: null as string | null,
    mysteryChosenChoice: null as unknown,
    mysteryPendingRemoval: false,
    runDeck: [],
    runTalentXP: {},
    talentXP: {},
  },
}));

vi.mock("@/features/alchemy/shared/stores/use-run-screen-data", () => ({
  useAlchemistScreenData: vi.fn(),
  useCampfireScreenData: vi.fn(),
  useCorruptionScreenData: vi.fn(),
  useDestinationScreenData: vi.fn(),
  useEquipmentShopScreenData: vi.fn(),
  useLabyrinthMapScreenData: vi.fn(),
  useMysteryScreenData: () => mysteryScreenData.current,
  useRewardsScreenData: vi.fn(),
  useShopScreenData: vi.fn(),
  useTrinketShopScreenData: vi.fn(),
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
    MysteryScreenShell: Screen,
    RewardsScreen: Screen,
    TrinketShopScreen: Screen,
    WildwoodRemovalScreen: Screen,
  };
});

vi.mock("@/features/alchemy/shared/stores/run-reads", () => ({
  useTalentEffects: () => ({}),
}));

const sampleEvent: MysteryEvent = {
  id: "held-event",
  title: "Held Event",
  art: "",
  narrative: "An event is in progress.",
  choices: [{ label: "Leave", effects: [] }],
};

afterEach(() => {
  cleanup();
  continueSpy.mockClear();
  mysteryScreenData.current = {
    mysteryEvent: null,
    mysteryCardChoices: null,
    mysteryGrantedTrinketIds: [],
    mysteryGrantedGearInstances: [],
    mysteryChosenCardId: null,
    mysteryChosenChoice: null,
    mysteryPendingRemoval: false,
    runDeck: [],
    runTalentXP: {},
    talentXP: {},
  };
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

  it("does not auto-continue when a held mystery event is cleared after Continue", () => {
    mysteryScreenData.current = {
      ...mysteryScreenData.current,
      mysteryEvent: sampleEvent,
    };
    const view = render(routeElement());
    expect(continueSpy).not.toHaveBeenCalled();

    mysteryScreenData.current = {
      ...mysteryScreenData.current,
      mysteryEvent: null,
    };
    view.rerender(routeElement());

    expect(continueSpy).not.toHaveBeenCalled();
  });

  it("keys recovery auto-continue by mystery event id", () => {
    const firstEvent = { ...sampleEvent, id: "first-event" };
    const secondEvent = { ...sampleEvent, id: "second-event" };
    const view = render(routeElement());
    expect(continueSpy).toHaveBeenCalledOnce();
    mysteryScreenData.current = { ...mysteryScreenData.current, mysteryEvent: firstEvent };
    view.rerender(routeElement());
    mysteryScreenData.current = { ...mysteryScreenData.current, mysteryEvent: null };
    view.rerender(routeElement());
    expect(continueSpy).toHaveBeenCalledOnce();

    mysteryScreenData.current = { ...mysteryScreenData.current, mysteryEvent: secondEvent };
    view.rerender(routeElement());
    mysteryScreenData.current = { ...mysteryScreenData.current, mysteryEvent: null };
    view.rerender(routeElement());

    expect(continueSpy).toHaveBeenCalledOnce();
  });
});
