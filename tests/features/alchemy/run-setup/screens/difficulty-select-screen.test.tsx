import "../../../../helpers/mock-audio";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DifficultySelectScreen } from "@/features/alchemy/run-setup/screens/difficulty-select-screen";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

describe("DifficultySelectScreen", () => {
  afterEach(() => {
    cleanup();
    useUiStore.setState({ hoveredCardId: null, shimmerState: null, plasmaInteraction: null });
  });

  it("renders hero info and difficulties with lock state", () => {
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

    expect(screen.getByText("A Knight's Journey")).toBeDefined();
    expect(screen.getByText("Knight")).toBeDefined();
    expect(screen.getByText("Block")).toBeDefined();

    const diff1Btn = screen.getByRole("button", { name: /Novice/i });
    const diff2Btn = screen.getByRole("button", { name: /Adventurer/i });
    const diff3Btn = screen.getByRole("button", { name: /Legend/i });

    expect(diff1Btn.getAttribute("disabled")).toBeNull();
    expect(diff2Btn.getAttribute("disabled")).toBeNull();
    expect(diff3Btn.getAttribute("disabled")).toBeNull();
    expect(diff2Btn.getAttribute("aria-disabled")).toBe("true");
    expect(diff3Btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("shows completed badge when difficulty is in completedDifficulties", () => {
    render(
      <DifficultySelectScreen
        characterId="knight"
        selectedDifficulty="difficulty-1"
        completedDifficulties={["difficulty-1"]}
        onSelect={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Completed")).toBeDefined();
    const diff2Btn = screen.getByRole("button", { name: /Adventurer/i });
    expect(diff2Btn.getAttribute("disabled")).toBeNull();
    expect(diff2Btn.getAttribute("aria-disabled")).toBe("false");
  });

  it("renders bonus XP on a separate line without a literal newline escape", () => {
    render(
      <DifficultySelectScreen
        characterId="knight"
        selectedDifficulty={null}
        completedDifficulties={["difficulty-1"]}
        onSelect={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const adventurer = screen.getByRole("button", { name: "Adventurer" });
    expect(adventurer.textContent).toContain("30% Bonus XP");
    expect(adventurer.textContent).not.toContain("\\n");
    expect(adventurer.querySelector("br")).not.toBeNull();
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

  it("triggers onBack when clicking Back button", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <DifficultySelectScreen
        characterId="knight"
        selectedDifficulty="difficulty-1"
        completedDifficulties={[]}
        onSelect={vi.fn()}
        onBack={onBack}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("displays unlock requirement tooltip on hovering locked difficulty", () => {
    render(
      <DifficultySelectScreen
        characterId="knight"
        selectedDifficulty={null}
        completedDifficulties={[]}
        onSelect={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const lockedDiff = screen.getByRole("button", { name: /Legend/i });
    const wrapper = lockedDiff.parentElement!;

    fireEvent.mouseEnter(wrapper);
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName.toLowerCase() === "p" &&
          element.textContent?.toLowerCase() === "clear previous difficulty to unlock",
      ),
    ).toBeDefined();

    fireEvent.mouseLeave(wrapper);
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
