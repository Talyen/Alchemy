import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameModeSelectScreen } from "@/features/alchemy/meta/screens/game-mode-select-screen";
import { installCatalogs, localization, text, displayText } from "@/lib/localization/runtime";
import catalogs from "@/lib/localization/locales/runtime.json";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { installFocusInputForTests } from "../../../../helpers/focus-input-test";

installFocusInputForTests(true);

describe("GameModeSelectScreen", () => {
  installDisabledAnimationsForTests();

  afterEach(async () => {
    cleanup();
    await localization.changeLanguage("en");
  });

  const defaultProps = {
    finishedRunCharacters: ["knight" as const, "rogue" as const, "ranger" as const],
    onSelectCampaign: vi.fn(),
    onSelectLabyrinth: vi.fn(),
    onSelectWildwood: vi.fn(),
  };

  it("routes unlocked modes and blocks the same actions after progression is locked", async () => {
    const user = userEvent.setup();
    const onSelectCampaign = vi.fn();
    const onSelectLabyrinth = vi.fn();
    const onSelectWildwood = vi.fn();

    const { rerender } = render(
      <GameModeSelectScreen
        {...defaultProps}
        onSelectCampaign={onSelectCampaign}
        onSelectLabyrinth={onSelectLabyrinth}
        onSelectWildwood={onSelectWildwood}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "The Campaign" }));
    expect(onSelectCampaign).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "The Labyrinth" }));
    expect(onSelectLabyrinth).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Wildwood Draft" }));
    expect(onSelectWildwood).toHaveBeenCalledTimes(1);

    onSelectCampaign.mockClear();
    onSelectLabyrinth.mockClear();
    onSelectWildwood.mockClear();
    rerender(
      <GameModeSelectScreen
        {...defaultProps}
        finishedRunCharacters={[]}
        onSelectCampaign={onSelectCampaign}
        onSelectLabyrinth={onSelectLabyrinth}
        onSelectWildwood={onSelectWildwood}
      />,
    );
    for (const name of ["The Labyrinth (Locked)", "Wildwood Draft (Locked)"]) {
      const locked = screen.getByRole("button", { name });
      expect(locked.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(locked);
      act(() => locked.focus());
      await user.keyboard("{Enter} ");
    }
    expect(onSelectLabyrinth).not.toHaveBeenCalled();
    expect(onSelectWildwood).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "The Campaign" }));
    expect(onSelectCampaign).toHaveBeenCalledTimes(1);
  });

  it("keeps a mode description visible while keyboard focus remains after the pointer leaves", () => {
    render(<GameModeSelectScreen {...defaultProps} />);
    const mode = screen.getByRole("button", { name: "The Campaign" });
    fireEvent.focus(mode);
    fireEvent.mouseEnter(mode);
    fireEvent.mouseLeave(mode);
    expect(screen.getByRole("tooltip").textContent).toContain("The Campaign");
  });

  it("updates locked accessible names in place when the language changes", async () => {
    installCatalogs(catalogs);
    render(<GameModeSelectScreen {...defaultProps} finishedRunCharacters={[]} />);
    const mode = screen.getByRole("button", { name: "The Labyrinth (Locked)" });
    await act(async () => {
      await localization.changeLanguage("de");
    });
    const expected = text("ui.game-mode-select-screen.locked", "{{value0}} (Locked)", {
      value0: displayText("The Labyrinth"),
    });
    expect(expected).not.toContain("Locked");
    expect(expected).not.toContain("The Labyrinth");
    expect(screen.getByRole("button", { name: expected })).toBe(mode);
    expect(mode.getAttribute("aria-disabled")).toBe("true");
  });
});
