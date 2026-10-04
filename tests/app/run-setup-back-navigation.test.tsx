import "../helpers/mock-audio";
import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReturnToRunNavigation } from "@/app/use-app-navigation";
import { useAppKeyboardShortcuts } from "@/app/use-app-keyboard-shortcuts";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { createMockRouteCommands } from "../helpers/run-controller";
import { resetAllTestStores, setRunProgress, setRunSession } from "../helpers/run-domain-store-test";

beforeEach(resetAllTestStores);
afterEach(() => {
  cleanup();
  resetEscapeStackForTests();
});

describe("difficulty Back navigation", () => {
  it.each(["button", "Escape"])("%s returns Wildcard to its drafted deck", (input) => {
    setRunProgress({ characterId: "wildcard" });
    setRunSession({ hasActiveRun: true, activity: { kind: "difficulty-select" } });
    const navigateTo = vi.fn();
    const commands = createContentSystemNavigation({
      navigateTo,
      resumeTo: vi.fn(),
      startBattle: vi.fn(),
      getAvailableDestinations: () => [],
      onResumeWildwood: vi.fn(),
    });
    const routeCommands = createMockRouteCommands();
    routeCommands.runSetup.handleBackFromDifficultySelect = commands.handleBackFromDifficultySelect;
    const run = { routeCommands, goToScreen: navigateTo, returnToBattle: vi.fn() };
    const { result } = renderHook(() => {
      const nav = useReturnToRunNavigation({ run, renderedScreen: "difficulty-select" });
      useAppKeyboardShortcuts({
        renderedScreen: "difficulty-select",
        screenInteractive: true,
        gameMenuOpen: false,
        onBack: nav.screenBackHandler,
        toggleGameMenu: vi.fn(),
      });
      return nav;
    });
    if (input === "button") result.current.screenBackHandler?.();
    else fireEvent.keyDown(window, { key: "Escape" });
    expect(navigateTo).toHaveBeenCalledWith("draft-deck");
  });
});
