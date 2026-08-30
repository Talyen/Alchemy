import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameModeSelectScreen } from "@/features/alchemy/meta/screens/game-mode-select-screen";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

describe("GameModeSelectScreen", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    resumableModes: { campaign: false, labyrinth: false, wildwood: false },
    finishedRunCharacters: ["knight" as const, "rogue" as const, "ranger" as const],
    onSelectCampaign: vi.fn(),
    onSelectLabyrinth: vi.fn(),
    onSelectWildwood: vi.fn(),
    onOpenMenu: vi.fn(),
  };

  it("renders the game mode chooser title and modes", () => {
    render(<GameModeSelectScreen {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Choose Your Adventure" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "The Campaign" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "The Labyrinth" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Wildwood Draft" })).toBeTruthy();
  });

  it("dispatches the selection handlers when unlocked modes are clicked", () => {
    const onSelectCampaign = vi.fn();
    const onSelectLabyrinth = vi.fn();
    const onSelectWildwood = vi.fn();

    render(
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
  });

  it("indicates resume state in the aria label when a mode has an active run", () => {
    render(
      <GameModeSelectScreen {...defaultProps} resumableModes={{ campaign: true, labyrinth: false, wildwood: false }} />,
    );

    expect(screen.getByRole("button", { name: "Resume The Campaign" })).toBeTruthy();
  });

  it("locks modes when unlock prerequisites are not met", () => {
    render(<GameModeSelectScreen {...defaultProps} finishedRunCharacters={[]} />);

    expect(screen.getByRole("button", { name: "The Campaign" }).getAttribute("aria-disabled")).toBeNull();
    expect(screen.getByRole("button", { name: "The Labyrinth (Locked)" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Wildwood Draft (Locked)" }).getAttribute("aria-disabled")).toBe("true");
  });
});
