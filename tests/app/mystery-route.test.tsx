import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { runLoopScreenRoutes } from "@/app/screen-routes/run-loop-routes";
import type { MysteryEffect, MysteryEvent } from "@/lib/mystery";
import { createMockRouteCommands } from "../helpers/run-controller";

const MysteryRoute = runLoopScreenRoutes.mystery;

const continueSpy = vi.fn();

const mysteryScreenData = vi.hoisted(() => ({
  current: {
    mysteryEvent: null as MysteryEvent | null,
    mysteryCardChoices: null as unknown,
    mysteryGrantedGearInstances: [] as unknown[],
    mysteryChosenCardId: null as string | null,
    mysteryChosenChoice: null as unknown,
    homesteadEffects: { homesteadHealing: 0, goldFindBonus: 0 },
    goldMultiplier: 1,
    runPlayerHealth: 10,
    runMaxHealth: 30,
    runTalentXP: {},
    talentXP: {},
  },
}));

const previewEffectSpy = vi.hoisted(() => ({
  current: null as ((effect: MysteryEffect) => MysteryEffect) | null,
}));

vi.mock("@/features/alchemy/shared/stores/react/use-run-screen-data", () => ({
  useRunScreenData: () => mysteryScreenData.current,
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
    CardShopScreen: Screen,
    MysteryScreen: ({ previewEffect }: { previewEffect?: (effect: MysteryEffect) => MysteryEffect }) => {
      previewEffectSpy.current = previewEffect ?? null;
      return null;
    },
    MysteryScreenShell: Screen,
    RewardsScreen: Screen,
    TrinketShopScreen: Screen,
    WildwoodRemovalScreen: Screen,
  };
});

vi.mock("@/features/alchemy/shared/stores/react/use-run-reads", () => ({
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
    mysteryGrantedGearInstances: [],
    mysteryChosenCardId: null,
    mysteryChosenChoice: null,
    homesteadEffects: { homesteadHealing: 0, goldFindBonus: 0 },
    goldMultiplier: 1,
    runPlayerHealth: 10,
    runMaxHealth: 30,
    runTalentXP: {},
    talentXP: {},
  };
  previewEffectSpy.current = null;
});

function routeElement() {
  return (
    <MysteryRoute
      routeCommands={{
        progress: createMockRouteCommands().progress,
        runLoop: {
          ...createMockRouteCommands().runLoop,
          mystery: {
            handleContinue: () => continueSpy(),
            handleChoice: vi.fn(),
            handleChooseCard: vi.fn(),
          },
        },
      }}
      onOpenGameMenu={vi.fn()}
    />
  );
}

describe("MysteryScreenRoute", () => {
  it("does not auto-continue twice when command identities change during recovery", () => {
    const view = render(routeElement());
    expect(continueSpy).toHaveBeenCalledOnce();

    view.rerender(routeElement());

    expect(continueSpy).toHaveBeenCalledOnce();
  });

  it("previews Mystery healing with the same Culinary Arts bonus applied by the choice", () => {
    mysteryScreenData.current = {
      ...mysteryScreenData.current,
      mysteryEvent: {
        ...sampleEvent,
        choices: [{ label: "Rest", effects: [{ kind: "healHealth", amount: 5 }] }],
      },
      homesteadEffects: { homesteadHealing: 3, goldFindBonus: 0 },
    };
    render(routeElement());

    expect(previewEffectSpy.current?.({ kind: "healHealth", amount: 5 })).toEqual({ kind: "healHealth", amount: 8 });
  });

  it("clamps the Mystery heal preview to missing Health like the choice does", () => {
    mysteryScreenData.current = {
      ...mysteryScreenData.current,
      mysteryEvent: {
        ...sampleEvent,
        choices: [{ label: "Rest", effects: [{ kind: "healHealth", amount: 5 }] }],
      },
      homesteadEffects: { homesteadHealing: 3, goldFindBonus: 0 },
      runPlayerHealth: 28,
      runMaxHealth: 30,
    };
    render(routeElement());

    expect(previewEffectSpy.current?.({ kind: "healHealth", amount: 5 })).toEqual({ kind: "healHealth", amount: 2 });
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
