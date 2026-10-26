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

  it("rejects a locked hero, then permits selection after its prerequisite finishes", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(<CharacterSelectScreen onSelect={onSelect} finishedRunCharacters={[]} />);
    expect(screen.getByRole("button", { name: "Select Knight" }).getAttribute("aria-disabled")).toBe("false");
    const locked = screen.getByRole("button", { name: "Rogue (Locked)" });
    expect(locked.getAttribute("aria-disabled")).toBe("true");
    await user.click(locked);
    expect(onSelect).not.toHaveBeenCalled();
    rerender(<CharacterSelectScreen onSelect={onSelect} finishedRunCharacters={["knight"]} />);
    const unlocked = screen.getByRole("button", { name: "Select Rogue" });
    expect(unlocked.getAttribute("aria-disabled")).toBe("false");
    await user.click(unlocked);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("rogue");
  });
});
