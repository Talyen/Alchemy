import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CharacterSelectScreen } from "@/features/alchemy/run-setup/screens/character-select-screen";

describe("CharacterSelectScreen", () => {
  afterEach(() => {
    cleanup();
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
});
