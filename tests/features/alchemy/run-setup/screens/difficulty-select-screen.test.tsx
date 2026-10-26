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

  it("explains a locked difficulty, rejects activation, and lets the player start an unlocked one", async () => {
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
    await user.keyboard("{Enter}{Space}");
    await user.click(adventurer);
    expect(adventurer.getAttribute("aria-pressed")).toBe("false");
    expect(play.getAttribute("disabled")).not.toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(novice);
    expect((play as HTMLButtonElement).disabled).toBe(false);
    await user.click(play);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("difficulty-1");
  });
});
