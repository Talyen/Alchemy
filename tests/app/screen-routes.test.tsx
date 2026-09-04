import { describe, expect, it, vi } from "vitest";
import { ROUTE_SCREEN_VALUES, type Screen } from "@/lib/routing";
import { renderAlchemyScreenRoute, SCREEN_ROUTES } from "@/app/screen-routes";
import type { RenderAlchemyScreenProps } from "@/app/screen-routes/route-ctx";
import { createMockRouteCommands } from "../helpers/run-controller";

vi.mock("@/features/alchemy/meta/screens", () => ({
  ArmoryScreen: () => <div data-testid="armory-screen" />,
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
  MerchantShopScreen: () => <div data-testid="merchant-shop-screen" />,
  MysteryScreen: () => <div data-testid="mystery-screen" />,
  MysteryScreenShell: () => <div data-testid="mystery-screen-shell" />,
  RewardsScreen: () => <div data-testid="rewards-screen" />,
  TrinketShopScreen: () => <div data-testid="trinket-shop-screen" />,
  WildwoodRemovalScreen: () => <div data-testid="wildwood-removal-screen" />,
}));

vi.mock("@/features/alchemy/run-loop/screens/run-end-screen", () => ({
  RunEndScreen: () => <div data-testid="run-end-screen" />,
}));

vi.mock("@/app/app-screen-chrome-context", () => ({
  useAppScreenChrome: () => ({
    characterId: "knight",
    heroArt: "",
    playerName: "Knight",
    aspectMode: "standard",
    stagePixelRatio: 1,
    hasUnspentTalents: false,
    hasAffordableHomestead: false,
    returnToRunScreen: null,
  }),
}));

function createMockProps(screen: Screen): RenderAlchemyScreenProps {
  return {
    screen,
    routeCommands: createMockRouteCommands(),
    onClearSaveData: vi.fn(),
    onUnlockAllDevMode: vi.fn(),
    onBackFromOptions: vi.fn(),
    gameMenuOpen: false,
  };
}

describe("SCREEN_ROUTES registry", () => {
  it("registers a handler for every Screen in ROUTE_SCREEN_VALUES", () => {
    const registeredScreens = Object.keys(SCREEN_ROUTES).sort();
    const expectedScreens = [...ROUTE_SCREEN_VALUES].sort();

    expect(registeredScreens).toEqual(expectedScreens);
  });

  it("renders with ErrorBoundary for every registered Screen", () => {
    for (const screen of ROUTE_SCREEN_VALUES) {
      const props = createMockProps(screen);
      const node = renderAlchemyScreenRoute(props);
      expect(node).toBeDefined();
    }
  });

  it("throws an explicit error when attempting to render an unregistered screen", () => {
    const invalidProps = createMockProps("unknown-screen" as Screen);
    expect(() => renderAlchemyScreenRoute(invalidProps)).toThrow("Missing screen route for unknown-screen");
  });
});
