import "../helpers/mock-audio";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { useReturnToRunNavigation } from "@/app/use-app-navigation";
import { useAppKeyboardShortcuts } from "@/app/use-app-keyboard-shortcuts";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { AppScreenChromeProvider } from "@/app/app-screen-chrome-context";
import { ErrorLogViewer } from "@/features/alchemy/meta/screens/options/error-log-viewer";
import { ArmoryInventoryControls } from "@/features/alchemy/meta/screens/armory/armory-inventory-controls";
import { GameMenu } from "@/features/alchemy/shared/ui/game-menu";
import { TransmutationScreen } from "@/features/alchemy/run-loop/screens/transmutation-screen";
import { selectTransmutation } from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { useRunScreenData } from "@/features/alchemy/shared/stores/react/use-run-screen-data";
import { cardById } from "@/lib/game-data";
import { createRunRngState } from "@/lib/rng";
import { defaultGameSession } from "@/app/application-session";
import { initializeAlchemyVisitForTest } from "../helpers/visit-initialization";
import { createMockRouteCommands } from "../helpers/run-controller";
import { resetAllTestStores, setRunProgress, setRunSession } from "../helpers/run-domain-store-test";
import { assertScreenTransitionAllowed, type Screen } from "@/lib/routing";

beforeEach(() => {
  resetAllTestStores();
  localStorage.setItem("alchemy-disable-animations", "true");
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(100);
});
afterEach(() => {
  cleanup();
  resetEscapeStackForTests();
  vi.restoreAllMocks();
  localStorage.removeItem("alchemy-disable-animations");
});

it.each(["armory", "collection", "talents", "homestead"] as const)(
  "returns main-menu browsing of %s to menu while a run is parked",
  (destination) => {
    setRunSession({ hasActiveRun: true, activity: { kind: "destination" } });
    const goToScreen = vi.fn();
    const returnToBattle = vi.fn();
    const run = { goToScreen, returnToBattle, routeCommands: createMockRouteCommands() };
    const { rerender } = renderHook(
      ({ current }: { current: Screen }) => {
        const nav = useReturnToRunNavigation({ run, renderedScreen: current });
        useAppKeyboardShortcuts({
          renderedScreen: current,
          screenInteractive: true,
          gameMenuOpen: false,
          onBack: nav.screenBackHandler,
          toggleGameMenu: vi.fn(),
        });
      },
      { initialProps: { current: "menu" as Screen } },
    );
    rerender({ current: destination });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(returnToBattle).not.toHaveBeenCalled();
    expect(goToScreen).toHaveBeenCalledExactlyOnceWith("menu");
  },
);

it("returns an Armory detour to character selection through an allowed transition", () => {
  const goToScreen = vi.fn();
  const run = { goToScreen, returnToBattle: vi.fn(), routeCommands: createMockRouteCommands() };
  const { result, rerender } = renderHook(
    ({ current }: { current: Screen }) => useReturnToRunNavigation({ run, renderedScreen: current }),
    { initialProps: { current: "character-select" as Screen } },
  );
  rerender({ current: "armory" });
  result.current.screenBackHandler?.();
  expect(goToScreen).toHaveBeenCalledExactlyOnceWith("character-select");
  expect(() => assertScreenTransitionAllowed("armory", "character-select")).not.toThrow();
});

it("closes Error Log consistently with Close, Back and Escape without leaving Options", () => {
  const leaveOptions = vi.fn();
  const closeLog = vi.fn();
  function Harness() {
    useAppKeyboardShortcuts({
      renderedScreen: "options",
      screenInteractive: true,
      gameMenuOpen: false,
      onBack: leaveOptions,
      toggleGameMenu: vi.fn(),
    });
    return (
      <AppScreenChromeProvider aspectMode="standard" stagePixelRatio={1} returnToRunScreen={null} onBack={leaveOptions}>
        <ErrorLogViewer onClose={closeLog} />
      </AppScreenChromeProvider>
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
  expect(closeLog).toHaveBeenCalledOnce();
  expect(leaveOptions).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Back", exact: true }));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(closeLog).toHaveBeenCalledTimes(3);
  expect(leaveOptions).not.toHaveBeenCalled();
});

it("closes the game menu before clearing Armory search with Escape", () => {
  const closeMenu = vi.fn();
  const filtersChanged = vi.fn();
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <ArmoryInventoryControls
          filters={{ search: "sword", keywords: [], rarities: [] }}
          isTrinket={false}
          onFiltersChange={filtersChanged}
          onSort={vi.fn()}
          onBrowse={vi.fn()}
        />
        <button onClick={() => setOpen(true)}>Open menu</button>
        <GameMenu
          isOpen={open}
          onClose={() => {
            closeMenu();
            setOpen(false);
          }}
          currentScreen="armory"
          anchorRect={null}
          onMainMenu={vi.fn()}
        />
      </>
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Open menu", exact: true }));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(filtersChanged).not.toHaveBeenCalled();
  expect(closeMenu).toHaveBeenCalledOnce();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(filtersChanged).toHaveBeenCalledExactlyOnceWith({ search: "", keywords: [], rarities: [] });
  expect(closeMenu).toHaveBeenCalledOnce();
});

it("uses Transmutation preview Back for Escape instead of opening the game menu", () => {
  setRunProgress({
    characterId: "wizard",
    runDeck: [cardById.slash!, cardById.frostbolt!],
    rng: createRunRngState(1234),
  });
  setRunSession({ hasActiveRun: true, activity: { kind: "destination" } });
  initializeAlchemyVisitForTest("transmutation", defaultGameSession);
  expect(selectTransmutation({ kind: "source", index: 0, card: cardById.slash! }, defaultGameSession)).toBe(true);
  const select = vi.fn();
  const toggleMenu = vi.fn();
  function Harness() {
    useAppKeyboardShortcuts({
      renderedScreen: "transmutation",
      screenInteractive: true,
      gameMenuOpen: false,
      toggleGameMenu: toggleMenu,
    });
    return (
      <TransmutationScreen
        {...useRunScreenData("transmutation")}
        onSelect={select}
        onExchange={vi.fn()}
        onContinue={vi.fn()}
      />
    );
  }
  render(<Harness />);
  fireEvent.keyDown(window, { key: "Escape" });
  expect(toggleMenu).not.toHaveBeenCalled();
  expect(select).toHaveBeenCalledExactlyOnceWith({ kind: "back" });
  fireEvent.click(screen.getByRole("button", { name: "Back", exact: true }));
  expect(select).toHaveBeenCalledTimes(2);
  expect(select).toHaveBeenLastCalledWith({ kind: "back" });
});

it.each(["button", "Escape"])("unwinds nested browsing with %s and resumes only the original activity", (input) => {
  setRunSession({ hasActiveRun: true, activity: { kind: "destination" } });
  const goToScreen = vi.fn();
  const resume = vi.fn();
  const run = { goToScreen, returnToBattle: resume, routeCommands: createMockRouteCommands() };
  const { result, rerender } = renderHook(
    ({ current }: { current: Screen }) => {
      const nav = useReturnToRunNavigation({ run, renderedScreen: current });
      useAppKeyboardShortcuts({
        renderedScreen: current,
        screenInteractive: true,
        gameMenuOpen: false,
        onBack: nav.screenBackHandler,
        toggleGameMenu: vi.fn(),
      });
      return nav;
    },
    { initialProps: { current: "destination" as Screen } },
  );
  for (const current of ["options", "collection", "armory"] as const) rerender({ current });
  for (const [current, target] of [
    ["armory", "collection"],
    ["collection", "options"],
  ] as const) {
    act(() => {
      if (input === "button") result.current.screenBackHandler?.();
      else fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(goToScreen).toHaveBeenLastCalledWith(target);
    expect(() => assertScreenTransitionAllowed(current, target)).not.toThrow();
    expect(resume).not.toHaveBeenCalled();
    rerender({ current: target });
  }
  act(() => {
    if (input === "button") result.current.screenBackHandler?.();
    else fireEvent.keyDown(window, { key: "Escape" });
  });
  expect(resume).toHaveBeenCalledOnce();
  // Explicit Main Menu discards prior run-origin browsing.
  rerender({ current: "menu" });
  rerender({ current: "armory" });
  act(() => result.current.screenBackHandler?.());
  expect(goToScreen).toHaveBeenLastCalledWith("menu");
  expect(resume).toHaveBeenCalledOnce();
});
