import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { runEndScreenRoutes } from "@/app/screen-routes/run-end-routes";
import { mutateGameplayForTest, resetAllTestStores } from "../helpers/run-domain-store-test";
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
  resetAllTestStores();
  state.demo = false;
  state.unlocks = [];
});

function mount() {
  const leave = vi.fn();
  const Route = runEndScreenRoutes["run-victory"];
  const view = render(
    <Route
      screen="run-victory"
      routeCommands={{ ...createMockRouteCommands(), runEnd: { continueFromRunEnd: leave } }}
      onOpenGameMenu={vi.fn()}
    />,
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

it("reveals a board after heroes and before leaving the run, with explicit equip acknowledgment", () => {
  mutateGameplayForTest((draft) => {
    draft.profile.collectedBoardIds.push("alpine-cuckoo");
    draft.profile.pendingBoardRewardId = "alpine-cuckoo";
  });
  state.unlocks = ["rogue"];
  const commands = createMockRouteCommands();
  const Route = runEndScreenRoutes["run-victory"];
  const view = render(<Route screen="run-victory" routeCommands={commands} onOpenGameMenu={vi.fn()} />);
  fireEvent.click(view.getByRole("button", { name: "Continue" }));
  fireEvent.click(view.getByRole("button", { name: "Continue" }));
  expect(view.getByRole("heading", { name: "Board Collected" })).toBeTruthy();
  expect(commands.runEnd.continueFromRunEnd).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Use Board" }));
  expect(commands.boards.acknowledgeReward).toHaveBeenCalledExactlyOnceWith("alpine-cuckoo", true);
  expect(commands.runEnd.continueFromRunEnd).toHaveBeenCalledOnce();
});

it("continues from a board reveal to demo completion without reopening the reveal", () => {
  state.demo = true;
  mutateGameplayForTest((draft) => {
    draft.profile.collectedBoardIds.push("alpine-cuckoo");
    draft.profile.pendingBoardRewardId = "alpine-cuckoo";
  });
  const commands = createMockRouteCommands();
  commands.boards.acknowledgeReward = vi.fn(() => {
    mutateGameplayForTest((draft) => {
      draft.profile.pendingBoardRewardId = null;
    });
    return true;
  });
  const Route = runEndScreenRoutes["run-victory"];
  const view = render(<Route screen="run-victory" routeCommands={commands} onOpenGameMenu={vi.fn()} />);
  fireEvent.click(view.getByRole("button", { name: "Continue" }));
  expect(view.getByRole("heading", { name: "Board Collected" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Continue" }));
  expect(view.getByRole("heading", { name: "Demo completion" })).toBeTruthy();
  expect(commands.runEnd.continueFromRunEnd).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Main Menu" }));
  expect(commands.runEnd.continueFromRunEnd).toHaveBeenCalledOnce();
});
