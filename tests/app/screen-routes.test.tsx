import { describe, expect, it, vi } from "vitest";
import { ROUTE_SCREEN_VALUES, type Screen } from "@/lib/routing";
import { renderAlchemyScreenRoute, SCREEN_ROUTES } from "@/app/screen-routes";
import type { RenderAlchemyScreenProps } from "@/app/screen-routes/route-ctx";

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
    routeCommands: {
      meta: {
        goToScreen: vi.fn(),
        beginCampaign: vi.fn(),
        beginLabyrinth: vi.fn(),
        beginWildwood: vi.fn(),
        unlockTalent: vi.fn(),
        resetUnlockedTalents: vi.fn(),
      },
      runSetup: {
        goToScreen: vi.fn(),
        handleCharacterSelect: vi.fn(),
        handleDifficultySelect: vi.fn(),
        handleBackFromDifficultySelect: vi.fn(),
        handleStarterDraftPick: vi.fn(),
        handleStandardDraftComplete: vi.fn(),
        handleWildwoodDraftPick: vi.fn(),
        handleWildwoodDraftComplete: vi.fn(),
      },
      runLoop: {
        labyrinth: {
          handleNodeSelect: vi.fn(),
          handleNodeDeselect: vi.fn(),
          handleNodeEnter: vi.fn(),
        },
        rewards: {
          selectChoice: vi.fn(),
          finish: vi.fn(),
        },
        wildwood: {
          removeCard: vi.fn(),
          skipRemoval: vi.fn(),
        },
        destinations: {
          choose: vi.fn(),
          prepare: vi.fn(),
          continueCampfire: vi.fn(),
        },
        shop: {
          merchant: {
            getCardBuyPrice: vi.fn(),
            getRemoveCardPrice: vi.fn(),
            getRefreshPrice: vi.fn(),
            handleBuyCard: vi.fn(),
            handleRemoveCard: vi.fn(),
            handleRefresh: vi.fn(),
            handleContinue: vi.fn(),
          },
          alchemist: {
            getPotionBuyPrice: vi.fn(),
            getMixPrice: vi.fn(),
            getRefreshPrice: vi.fn(),
            handleBuyCard: vi.fn(),
            handleRefresh: vi.fn(),
            handleMixPotions: vi.fn(),
            handleContinue: vi.fn(),
          },
          trinket: {
            getBuyPrice: vi.fn(),
            getRefreshPrice: vi.fn(),
            handleBuy: vi.fn(),
            handleRefresh: vi.fn(),
            handleContinue: vi.fn(),
          },
          equipment: {
            getBuyPrice: vi.fn(),
            getRefreshPrice: vi.fn(),
            handleBuy: vi.fn(),
            handleRefresh: vi.fn(),
            handleContinue: vi.fn(),
          },
        },
        mystery: {
          handleChoice: vi.fn(),
          handleChooseCard: vi.fn(),
          handleRemoveCard: vi.fn(),
          handleContinue: vi.fn(),
        },
        corruption: {
          handleCorruptCard: vi.fn(),
          handleExit: vi.fn(),
        },
      },
      battle: {
        screen: "battle",
        refs: {} as never,
        handleCardClick: vi.fn(),
        handleWishChoice: vi.fn(),
        skipCombatDevMode: vi.fn(),
        handleEndTurn: vi.fn(),
        isAutoplayEnabled: false,
        setAutoplayEnabled: vi.fn(),
        bindPlayback: vi.fn(),
        handleAutoplayCard: vi.fn(),
        isCardPlayInProgress: vi.fn(() => false),
      },
      runEnd: {
        continueFromRunEnd: vi.fn(),
      },
    },
    onOpenBattleMenu: vi.fn(),
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
