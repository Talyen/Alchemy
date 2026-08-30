import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterSelectScreen } from "@/features/alchemy/run-setup/screens/character-select-screen";
import { getPlasmaColorPairForCharacter } from "@/features/alchemy/shared/config";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

describe("CharacterSelectScreen", () => {
  afterEach(() => {
    cleanup();
    useUiStore.setState({ hoveredCardId: null, shimmerState: null, plasmaInteraction: null });
  });

  it("renders heroes and respects finishedRunCharacters unlock state", () => {
    const onSelect = vi.fn();
    const onOpenMenu = vi.fn();

    const { rerender } = render(
      <CharacterSelectScreen onSelect={onSelect} onOpenMenu={onOpenMenu} finishedRunCharacters={[]} />,
    );

    const knight = screen.getByRole("button", { name: /Knight/i });
    const rogue = screen.getByRole("button", { name: /Rogue/i });

    expect(knight.getAttribute("aria-disabled")).toBe("false");
    expect(rogue.getAttribute("aria-disabled")).toBe("true");

    rerender(<CharacterSelectScreen onSelect={onSelect} onOpenMenu={onOpenMenu} finishedRunCharacters={["knight"]} />);

    expect(screen.getByRole("button", { name: /Rogue/i }).getAttribute("aria-disabled")).toBe("false");
  });

  it("triggers onSelect when clicking an unlocked hero", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onOpenMenu = vi.fn();

    render(<CharacterSelectScreen onSelect={onSelect} onOpenMenu={onOpenMenu} finishedRunCharacters={[]} />);

    await user.click(screen.getByRole("button", { name: /Knight/i }));
    expect(onSelect).toHaveBeenCalledWith("knight");
  });

  it("uses the hero tooltip as the plasma owner for pointer and keyboard interaction", async () => {
    render(<CharacterSelectScreen onSelect={vi.fn()} onOpenMenu={vi.fn()} finishedRunCharacters={[]} />);
    const knight = screen.getByRole("button", { name: "Select Knight" });
    const wrapper = knight.parentElement!;

    fireEvent.mouseEnter(wrapper);
    await waitFor(() =>
      expect(useUiStore.getState().plasmaInteraction?.colorPair).toEqual(getPlasmaColorPairForCharacter("knight")),
    );
    fireEvent.mouseLeave(wrapper);
    await waitFor(() => expect(useUiStore.getState().plasmaInteraction).toBeNull());

    fireEvent.focus(knight);
    await waitFor(() =>
      expect(useUiStore.getState().plasmaInteraction?.colorPair).toEqual(getPlasmaColorPairForCharacter("knight")),
    );
    fireEvent.blur(knight);
    await waitFor(() => expect(useUiStore.getState().plasmaInteraction).toBeNull());
  });

  it("rejects selection of a locked hero", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CharacterSelectScreen onSelect={onSelect} onOpenMenu={vi.fn()} finishedRunCharacters={[]} />);

    await user.click(screen.getByRole("button", { name: "Rogue (Locked)" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
