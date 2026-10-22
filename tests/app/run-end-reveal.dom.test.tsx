import { resetAllTestStores } from "../helpers/run-domain-store-test";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { runEndScreenRoutes } from "@/app/screen-routes/run-end-routes";
import { createMockRouteCommands } from "../helpers/run-controller";
import type { CharacterId } from "@/lib/game-data";

const state = vi.hoisted(() => ({ demo: false, unlocks: [] as string[] }));
vi.mock("@/lib/game-edition", () => ({
  get IS_DEMO() {
    return state.demo;
  },
  isEditionCharacterAvailable: (id: string) => !state.demo || id === "rogue",
}));
vi.mock("@/lib/platform", () => ({ isDesktop: () => false }));
vi.mock("@/features/alchemy/shared/stores/react/use-run-screen-data", () => ({
  useRunScreenData: () => ({ runEndUnlockedCharacters: state.unlocks }),
}));
vi.mock("@/features/alchemy/run-loop/screens/run-end-screen", () => ({
  RunEndScreen: ({ onContinue, continueLabel }: { onContinue: () => void; continueLabel: string }) => (
    <button onClick={onContinue}>{continueLabel}</button>
  ),
}));
vi.mock("@/features/alchemy/run-loop/screens/hero-unlocked-screen", () => ({
  HeroUnlockedScreen: ({
    characterId,
    onContinue,
    continueLabel,
  }: {
    characterId: CharacterId;
    onContinue: () => void;
    continueLabel: string;
  }) => (
    <>
      <h1>{characterId}</h1>
      <button onClick={onContinue}>{continueLabel}</button>
    </>
  ),
}));
vi.mock("@/features/alchemy/run-loop/screens/demo-completion-screen", () => ({
  DemoCompletionScreen: ({ onMainMenu }: { onMainMenu: () => void }) => (
    <>
      <h1>Demo completion</h1>
      <button onClick={onMainMenu}>Main Menu</button>
    </>
  ),
}));
afterEach(() => {
  cleanup();
  resetAllTestStores();
  state.demo = false;
  state.unlocks = [];
});

function mount(screen: "game-over" | "run-victory" = "run-victory") {
  const leave = vi.fn();
  const Route = runEndScreenRoutes[screen];
  const view = render(
    <Route
      screen={screen}
      routeCommands={{ ...createMockRouteCommands(), runEnd: { resetRunState: leave } }}
      onOpenGameMenu={vi.fn()}
    />,
  );
  return { ...view, leave };
}

it.each(["game-over", "run-victory"] as const)("retains the last hero while %s leaves for the menu", (screen) => {
  state.unlocks = ["rogue", "ranger"];
  const view = mount(screen);
  fireEvent.click(view.getByRole("button", { name: "Continue" }));
  expect(view.getByRole("heading").textContent).toBe("rogue");
  fireEvent.click(view.getByRole("button", { name: "Continue" }));
  expect(view.getByRole("heading").textContent).toBe("ranger");
  expect(view.leave).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Main Menu" }));
  expect(view.leave).toHaveBeenCalledOnce();
  expect(view.getByRole("heading").textContent).toBe("ranger");
});

it("reveals only edition-available heroes before demo completion", () => {
  state.demo = true;
  state.unlocks = ["rogue", "wizard"];
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Continue" }));
  expect(view.getByRole("heading").textContent).toBe("rogue");
  fireEvent.click(view.getByRole("button", { name: "Continue" }));
  expect(view.getByRole("heading").textContent).toBe("Demo completion");
  expect(view.leave).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Main Menu" }));
  expect(view.leave).toHaveBeenCalledOnce();
});
