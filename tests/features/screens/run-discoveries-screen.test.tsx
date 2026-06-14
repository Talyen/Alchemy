// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunDiscoveriesScreen } from "@/features/alchemy/run-loop/screens/run-discoveries-screen";

vi.mock("@/lib/audio", () => ({
  playBattleEvent: vi.fn(),
  playUISound: vi.fn(),
}));

describe("RunDiscoveriesScreen", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows discoveries copy and opens the first pack", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();

    render(
      <RunDiscoveriesScreen
        runEndDiscoveredCardIds={["slash", "block"]}
        runEndDiscoveredBoonIds={[]}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByText("Discoveries")).toBeTruthy();
    expect(screen.getByText("New cards and boons added to your collection")).toBeTruthy();
    expect(screen.getByLabelText("Open discovery pack")).toBeTruthy();

    await user.click(screen.getByLabelText("Open discovery pack"));

    await waitFor(() => {
      const continueButton = screen.getByRole("button", { name: "Continue" });
      expect(continueButton.hasAttribute("disabled")).toBe(false);
    });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("pages through additional cards in place with Continue", async () => {
    const user = userEvent.setup();

    render(
      <RunDiscoveriesScreen
        runEndDiscoveredCardIds={["slash", "block", "fireball", "stab", "bash", "apple"]}
        runEndDiscoveredBoonIds={[]}
        onContinue={() => {}}
      />,
    );

    await user.click(screen.getByLabelText("Open discovery pack"));

    await waitFor(
      () => {
        const continueButton = screen.getByRole("button", { name: "Continue" });
        expect(continueButton.hasAttribute("disabled")).toBe(false);
      },
      { timeout: 3000 },
    );
    expect(screen.queryByLabelText("Open discovery pack")).toBeNull();
    expect(screen.queryByText("Next Pack")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(
      () => {
        expect(screen.getByLabelText("Inspect Apple")).toBeTruthy();
      },
      { timeout: 5000 },
    );
    expect(screen.queryByLabelText("Open discovery pack")).toBeNull();
    expect(screen.queryByText("Next Pack")).toBeNull();
  });
});
