import "../../../../helpers/mock-audio";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DifficultySelectScreen } from "@/features/alchemy/run-setup/screens/difficulty-select-screen";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import { installFocusInputForTests } from "../../../../helpers/focus-input-test";

installFocusInputForTests(true);

describe("DifficultySelectScreen", () => {
  afterEach(() => {
    cleanup();
    useUiStore.setState({ hoveredCardId: null, shimmerState: null, plasmaInteraction: null });
  });

  it("allows selecting an unlocked difficulty and pressing Play", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onBack = vi.fn();

    render(
      <DifficultySelectScreen
        characterId="knight"
        selectedDifficulty={null}
        completedDifficulties={[]}
        onSelect={onSelect}
        onBack={onBack}
      />,
    );

    const playButton = screen.getByRole("button", { name: /Play/i });
    expect(playButton.getAttribute("disabled")).not.toBeNull();

    const diff1Btn = screen.getByRole("button", { name: /Novice/i });
    await user.click(diff1Btn);

    expect(playButton.getAttribute("disabled")).toBeNull();
    await user.click(playButton);

    expect(onSelect).toHaveBeenCalledWith("difficulty-1");
  });

  it("explains a locked difficulty on keyboard focus without allowing selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DifficultySelectScreen
        characterId="knight"
        selectedDifficulty={null}
        completedDifficulties={[]}
        onSelect={onSelect}
        onBack={vi.fn()}
      />,
    );

    const novice = screen.getByRole("button", { name: "Novice" });
    const adventurer = screen.getByRole("button", { name: "Adventurer" });
    const play = screen.getByRole("button", { name: "Play" });
    const hintId = adventurer.getAttribute("aria-describedby");
    expect(hintId).not.toBeNull();
    expect(document.getElementById(hintId!)?.textContent).toBe("Clear previous Difficulty to unlock");

    novice.focus();
    await user.tab();
    expect(document.activeElement).toBe(adventurer);
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName.toLowerCase() === "p" &&
          element.textContent?.toLowerCase() === "clear previous difficulty to unlock",
      ),
    ).toBeDefined();

    await user.keyboard("{Enter}{Space}");
    await user.click(adventurer);
    expect(adventurer.getAttribute("aria-pressed")).toBe("false");
    expect(play.getAttribute("disabled")).not.toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
