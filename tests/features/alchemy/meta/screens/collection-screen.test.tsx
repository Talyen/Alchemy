import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionScreen } from "@/features/alchemy/meta/screens/collection-screen";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

describe("CollectionScreen", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    collectionTab: "cards" as const,
    onSelectTab: vi.fn(),
    discoveredCardIds: ["strike-basic", "defend-basic"],
    encounteredEnemyIds: ["goblin-scout"],
    discoveredTrinketIds: ["ruby-ring"],
    discoveredUniqueIds: [],
    finishedRunCharacters: ["knight" as const],
    collectionPages: {
      heroes: 0,
      cards: 0,
      bestiary: 0,
      trinkets: 0,
      uniques: 0,
    },
    onPageChange: vi.fn(),
    bondedCompanions: {},
  };

  it("renders collection screen header and tabs", () => {
    render(<CollectionScreen {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Collection" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Heroes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cards" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bestiary" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Trinkets" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Uniques" })).toBeTruthy();
  });

  it("calls onSelectTab when switching tabs", () => {
    const onSelectTab = vi.fn();
    render(<CollectionScreen {...defaultProps} onSelectTab={onSelectTab} />);

    fireEvent.click(screen.getByRole("button", { name: "Bestiary" }));
    expect(onSelectTab).toHaveBeenCalledWith("bestiary");
  });

  it("handles pagination clicks", () => {
    const onPageChange = vi.fn();
    render(<CollectionScreen {...defaultProps} onPageChange={onPageChange} />);

    const nextButton = screen.getByRole("button", { name: "Next page" });
    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith("cards", 1);
  });
});
