import "../helpers/mock-audio";

import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useReturnToRunNavigation } from "@/app/use-app-navigation";
import { useAppKeyboardShortcuts } from "@/app/use-app-keyboard-shortcuts";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { createMockRouteCommands } from "../helpers/run-controller";
import { resetAllTestStores, setRunProgress, setRunSession } from "../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";

beforeEach(resetAllTestStores);
afterEach(() => {
  cleanup();
  resetEscapeStackForTests();
});

it.each(["button", "Escape"])("difficulty Back navigation %s returns Wildcard to its drafted deck", (input) => {
  setRunProgress({ characterId: "wildcard" });
  setRunSession({ hasActiveRun: true, activity: { kind: "difficulty-select" } });
  const navigateTo = vi.fn();
  const commands = createContentSystemNavigation(
    {
      navigateTo,
      resumeTo: vi.fn(),
      presentBattleStart: vi.fn(),
      onResumeWildwood: vi.fn(),
    },
    defaultGameSession,
  );
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

it("returns from Options Boards to Options and then to the original screen", () => {
  const goToScreen = vi.fn();
  const run = { routeCommands: createMockRouteCommands(), goToScreen, returnToBattle: vi.fn() };
  const { result, rerender } = renderHook(({ renderedScreen }) => useReturnToRunNavigation({ run, renderedScreen }), {
    initialProps: { renderedScreen: "menu" as import("@/lib/routing").Screen },
  });
  rerender({ renderedScreen: "options" });
  act(() => result.current.openBoardsFromOptions());
  rerender({ renderedScreen: "collection" });
  result.current.screenBackHandler?.();
  expect(goToScreen).toHaveBeenLastCalledWith("options");
  rerender({ renderedScreen: "options" });
  result.current.screenBackHandler?.();
  expect(goToScreen).toHaveBeenLastCalledWith("menu");
});

it("leaves Collection normally after returning through its own Options Boards shortcut", () => {
  const goToScreen = vi.fn();
  const run = { routeCommands: createMockRouteCommands(), goToScreen, returnToBattle: vi.fn() };
  const { result, rerender } = renderHook(({ renderedScreen }) => useReturnToRunNavigation({ run, renderedScreen }), {
    initialProps: { renderedScreen: "collection" as import("@/lib/routing").Screen },
  });
  // Establish Collection as the original Options return target.
  rerender({ renderedScreen: "menu" });
  rerender({ renderedScreen: "collection" });
  rerender({ renderedScreen: "options" });
  act(() => result.current.openBoardsFromOptions());
  rerender({ renderedScreen: "collection" });
  result.current.screenBackHandler?.();
  expect(goToScreen).toHaveBeenLastCalledWith("options");
  rerender({ renderedScreen: "options" });
  result.current.screenBackHandler?.();
  expect(goToScreen).toHaveBeenLastCalledWith("collection");
  rerender({ renderedScreen: "collection" });
  result.current.screenBackHandler?.();
  expect(goToScreen).toHaveBeenLastCalledWith("menu");
});
