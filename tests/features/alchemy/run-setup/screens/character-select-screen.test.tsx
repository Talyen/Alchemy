import "../../../../helpers/mock-audio";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterSelectScreen } from "@/features/alchemy/run-setup/screens/character-select-screen";

import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

describe("CharacterSelectScreen", () => {
  afterEach(() => {
    cleanup();
    useUiStore.setState({ hoveredCardId: null, shimmerState: null, plasmaInteraction: null });
  });

  it("renders heroes and respects finishedRunCharacters unlock state", () => {
    const onSelect = vi.fn();

    const { rerender } = render(<CharacterSelectScreen onSelect={onSelect} finishedRunCharacters={[]} />);

    const knight = screen.getByRole("button", { name: /Knight/i });
    const rogue = screen.getByRole("button", { name: /Rogue/i });

    expect(knight.getAttribute("aria-disabled")).toBe("false");
    expect(rogue.getAttribute("aria-disabled")).toBe("true");

    rerender(<CharacterSelectScreen onSelect={onSelect} finishedRunCharacters={["knight"]} />);

    expect(screen.getByRole("button", { name: /Rogue/i }).getAttribute("aria-disabled")).toBe("false");
  });

  it("triggers onSelect when clicking an unlocked hero", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<CharacterSelectScreen onSelect={onSelect} finishedRunCharacters={[]} />);

    await user.click(screen.getByRole("button", { name: /Knight/i }));
    expect(onSelect).toHaveBeenCalledWith("knight");
  });

  it("rejects selection of a locked hero", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CharacterSelectScreen onSelect={onSelect} finishedRunCharacters={[]} />);

    await user.click(screen.getByRole("button", { name: "Rogue (Locked)" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
