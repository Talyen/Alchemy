import { sessionRuntime } from "@/features/alchemy/shared/stores/session-runtime";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ROUTE_SCREEN_VALUES, type Screen } from "@/lib/routing";
import { renderAlchemyScreenRoute } from "@/app/screen-routes";
import type { RenderAlchemyScreenProps } from "@/app/screen-routes/route-ctx";
import { createMockRouteCommands } from "../helpers/run-controller";
import { resetAllTestStores, setRunSession } from "../helpers/run-domain-store-test";
import { initializeAlchemyVisitForTest as initializeAlchemyVisit } from "../helpers/visit-initialization";
import { defaultGameSession } from "@/app/application-session";
import { emptyAlchemyVisit, type AlchemyVisit } from "@/lib/active-run-session/alchemy-visits";

const { transmutationRender, armoryRender } = vi.hoisted(() => ({
  transmutationRender: vi.fn(),
  armoryRender: vi.fn(),
}));

vi.mock("@/features/alchemy/meta/screens", () => ({
  ArmoryScreen: (props: unknown) => {
    armoryRender(props);
    return <div data-testid="armory-screen" />;
  },
  CollectionScreen: () => <div data-testid="collection-screen" />,
  GameModeSelectScreen: () => <div data-testid="game-mode-select-screen" />,
  HomesteadScreen: () => <div data-testid="homestead-screen" />,
  MenuScreen: () => <div data-testid="menu-screen" />,
  OptionsScreen: () => <div data-testid="options-screen" />,
  TalentsScreen: () => <div data-testid="talents-screen" />,
}));

vi.mock("@/features/alchemy/run-setup/screens", () => ({
  CharacterSelectScreen: () => <div data-testid="character-select-screen" />,
  DifficultySelectScreen: () => <div data-testid="difficulty-select-screen" />,
  DraftDeckScreen: () => <div data-testid="draft-deck-screen" />,
}));

vi.mock("@/features/alchemy/run-loop/screens", () => ({
  AlchemistShopScreen: () => <div data-testid="alchemist-shop-screen" />,
  BattleScreen: () => <div data-testid="battle-screen" />,
  CampfireScreen: () => <div data-testid="campfire-screen" />,
  CorruptionScreen: () => <div data-testid="corruption-screen" />,
  DestinationScreen: () => <div data-testid="destination-screen" />,
  EquipmentShopScreen: () => <div data-testid="equipment-shop-screen" />,
  LabyrinthMapScreen: () => <div data-testid="labyrinth-map-screen" />,
  CardShopScreen: () => <div data-testid="card-shop-screen" />,
  MysteryScreen: () => <div data-testid="mystery-screen" />,
  MysteryScreenShell: () => <div data-testid="mystery-screen-shell" />,
  RewardsScreen: () => <div data-testid="rewards-screen" />,
  TrinketShopScreen: () => <div data-testid="trinket-shop-screen" />,
  WildwoodRemovalScreen: () => <div data-testid="wildwood-removal-screen" />,
}));

vi.mock("@/features/alchemy/run-loop/screens/run-end-screen", () => ({
  RunEndScreen: ({ title }: { title: string }) => <div data-testid="run-end-screen">{title}</div>,
}));

vi.mock("@/features/alchemy/run-loop/screens/transmutation-screen", () => ({
  TransmutationScreen: ({ visit }: { visit: AlchemyVisit }) => {
    transmutationRender(visit);
    return <div data-testid="transmutation-screen" />;
  },
}));

vi.mock("@/app/app-screen-chrome-context", () => ({
  useAppScreenChrome: () => ({
    characterId: "knight",
    heroArt: "",
    playerName: "Knight",
    aspectMode: "standard",
    stagePixelRatio: 1,
    returnToRunScreen: null,
  }),
  useMenuBadges: () => ({
    hasUnspentTalents: false,
    hasAffordableHomestead: false,
  }),
}));

function createMockProps(screen: Screen): RenderAlchemyScreenProps {
  const routeCommands = createMockRouteCommands();
  return {
    screen,
    routeCommands,
    onClearSaveData: vi.fn(),
    onUnlockAllDevMode: vi.fn(),
    onBack: vi.fn(),
    gameMenuOpen: false,
    onOpenGameMenu: vi.fn(),
  };
}

describe("SCREEN_ROUTES registry", () => {
  afterEach(cleanup);

  it("mounts the correct component while navigating across every registered Screen", () => {
    const view = render(renderAlchemyScreenRoute(createMockProps("menu")));
    const screenTestIds: Partial<Record<Screen, string>> = {
      shop: "card-shop-screen",
      alchemist: "alchemist-shop-screen",
      mystery: "mystery-screen-shell",
      "game-over": "run-end-screen",
      "run-victory": "run-end-screen",
    };
    for (const screen of ROUTE_SCREEN_VALUES) {
      view.rerender(renderAlchemyScreenRoute(createMockProps(screen)));
      expect(view.getByTestId(screenTestIds[screen] ?? `${screen}-screen`)).toBeDefined();
      if (screen === "game-over" || screen === "run-victory") {
        expect(view.getByTestId("run-end-screen").textContent).toBe(
          screen === "game-over" ? "Journey’s End" : "Victory",
        );
      }
    }
  });

  it("mounts and remounts committed Transmutation offers while saving without changing gameplay", () => {
    resetAllTestStores();
    setRunSession({ hasActiveRun: true, activity: { kind: "destination" } });
    transmutationRender.mockClear();
    const props = createMockProps("transmutation");
    const completion = sessionRuntime(defaultGameSession).progressCompletion;
    const deactivate = completion.registerRetryDriver(vi.fn());
    try {
      initializeAlchemyVisit("transmutation", defaultGameSession);
      expect(completion.read().kind).toBe("saving");
      const before = readGameplayState(defaultGameSession);
      const view = render(renderAlchemyScreenRoute(props));
      view.unmount();
      render(renderAlchemyScreenRoute(props));
      expect(readGameplayState(defaultGameSession)).toBe(before);
      expect(transmutationRender).toHaveBeenCalled();
      for (const [visit] of transmutationRender.mock.calls) {
        expect(visit.transmutation?.choices).toHaveLength(3);
        expect(visit.completed).toBe(false);
      }
    } finally {
      cleanup();
      deactivate();
    }
  });

  it.each(["campfire", "transmutation"] as const)("remounting damaged %s data does not reroll offers", (kind) => {
    resetAllTestStores();
    setRunSession({ hasActiveRun: true, activity: { kind, data: emptyAlchemyVisit() } });
    const before = readGameplayState(defaultGameSession);
    const props = createMockProps(kind);
    const view = render(renderAlchemyScreenRoute(props));
    view.unmount();
    render(renderAlchemyScreenRoute(props));
    expect(readGameplayState(defaultGameSession)).toBe(before);
  });

  it("routes ArmoryScreen with route commands and progress callbacks", () => {
    armoryRender.mockClear();
    const props = createMockProps("armory");
    render(renderAlchemyScreenRoute(props));
    expect(armoryRender).toHaveBeenCalled();
    const [passedProps] = armoryRender.mock.calls[0] as [
      { onEquip: unknown; onUnequip: unknown; onSalvage: unknown; afterProgressSaved: unknown },
    ];
    expect(passedProps.onEquip).toBe(props.routeCommands.meta.armory.onEquip);
    expect(passedProps.onUnequip).toBe(props.routeCommands.meta.armory.onUnequip);
    expect(passedProps.onSalvage).toBe(props.routeCommands.meta.armory.onSalvage);
    expect(passedProps.afterProgressSaved).toBe(props.routeCommands.progress.afterSaved);
  });

  it("throws an explicit error when attempting to render an unregistered screen", () => {
    const invalidProps = createMockProps("unknown-screen" as Screen);
    expect(() => renderAlchemyScreenRoute(invalidProps)).toThrow("Missing screen route for unknown-screen");
  });
});
