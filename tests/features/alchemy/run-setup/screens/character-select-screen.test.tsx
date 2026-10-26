import "../../../../helpers/mock-audio";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterSelectScreen } from "@/features/alchemy/run-setup/screens/character-select-screen";

import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";

describe("CharacterSelectScreen", () => {
  afterEach(() => {
    cleanup();
    useUiStore.setState({ hoveredCardId: null, shimmerState: null, plasmaInteraction: null });
  });

  it("blocks a locked hero, then selects that same hero after progression unlocks it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    const { rerender } = render(<CharacterSelectScreen onSelect={onSelect} finishedRunCharacters={[]} />);

    const knight = screen.getByRole("button", { name: /Knight/i });
    const rogue = screen.getByRole("button", { name: /Rogue/i });

    expect(knight.getAttribute("aria-disabled")).toBe("false");
    expect(rogue.getAttribute("aria-disabled")).toBe("true");

    await user.click(rogue);
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(knight);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("knight");
    onSelect.mockClear();

    rerender(<CharacterSelectScreen onSelect={onSelect} finishedRunCharacters={["knight"]} />);
    const unlocked = screen.getByRole("button", { name: "Select Rogue" });
    expect(unlocked.getAttribute("aria-disabled")).toBe("false");
    await user.click(unlocked);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("rogue");
  });
});
