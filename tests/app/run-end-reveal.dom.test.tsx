import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { runEndScreenRoutes } from "@/app/screen-routes/run-end-routes";
import type { CharacterId } from "@/lib/game-data";

const state = vi.hoisted(() => ({ demo: false, unlocks: [] as string[] }));
vi.mock("@/lib/game-edition", () => ({
  get IS_DEMO() {
    return state.demo;
  },
  isEditionCharacterAvailable: (id: string) => !state.demo || id === "rogue",
}));
vi.mock("@/lib/platform", () => ({ isDesktop: () => false }));
vi.mock("@/features/alchemy/shared/stores/use-run-screen-data", () => ({
  useRunEndScreenData: () => ({ runEndUnlockedCharacters: state.unlocks }),
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
  state.demo = false;
  state.unlocks = [];
});

function mount() {
  const leave = vi.fn();
  const Route = runEndScreenRoutes["run-victory"];
  const view = render(
    <Route screen="run-victory" routeCommands={{ runEnd: { continueFromRunEnd: leave } }} onOpenGameMenu={vi.fn()} />,
  );
  return { ...view, leave };
}

it("presents every new hero before dispatching the existing menu command", () => {
  state.unlocks = ["rogue", "ranger"];
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Continue" }));
  expect(view.getByRole("heading").textContent).toBe("rogue");
  fireEvent.click(view.getByRole("button", { name: "Continue" }));
  expect(view.getByRole("heading").textContent).toBe("ranger");
  expect(view.leave).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Main Menu" }));
  expect(view.leave).toHaveBeenCalledOnce();
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

it("retains direct menu navigation when the run unlocked no heroes", () => {
  const view = mount();
  fireEvent.click(view.getByRole("button", { name: "Main Menu" }));
  expect(view.leave).toHaveBeenCalledOnce();
});
