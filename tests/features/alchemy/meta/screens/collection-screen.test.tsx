import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionScreen } from "@/features/alchemy/meta/screens/collection-screen";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { enemyBestiary } from "@/lib/game-data";
import { getBossMusicKey } from "@/lib/audio";

const audio = vi.hoisted(() => ({ playMusic: vi.fn(), playEnemyAttack: vi.fn() }));
vi.mock("@/lib/audio", async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), ...audio }));

describe("CollectionScreen", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
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

  it("renders undiscovered items with hover opacity and grayscale classes", () => {
    const { container } = render(<CollectionScreen {...defaultProps} discoveredCardIds={[]} />);

    const images = container.querySelectorAll("img");
    const undiscoveredImg = Array.from(images).find((img) => img.className.includes("grayscale"));
    expect(undiscoveredImg).toBeTruthy();
    expect(undiscoveredImg?.className).toContain("opacity-45");
    expect(undiscoveredImg?.className).toContain("group-hover:grayscale-0");
    expect(undiscoveredImg?.className).toContain("group-hover:opacity-100");
  });

  it("opens Boss inspection while preserving music preview across closing and reopening", () => {
    const id = "forge-golem";
    const sorted = [...enemyBestiary].sort((a, b) => a.title.localeCompare(b.title));
    const page = Math.floor(sorted.findIndex((entry) => entry.id === id) / 6);
    render(
      <CollectionScreen
        {...defaultProps}
        collectionTab="bestiary"
        encounteredEnemyIds={[id]}
        collectionPages={{ ...defaultProps.collectionPages, bestiary: page }}
      />,
    );
    const portrait = screen.getByRole("button", { name: "Inspect The Forge Golem" });
    fireEvent.click(portrait);
    expect(audio.playEnemyAttack).toHaveBeenCalledWith(id);
    expect(audio.playMusic).toHaveBeenCalledWith(getBossMusicKey(id));
    const dialog = screen.getByRole("dialog", { name: "The Forge Golem" });
    expect(
      within(dialog)
        .getAllByRole("img")
        .map((image) => image.getAttribute("alt")),
    ).toEqual(["Sunder", "Bash", "Molten Bulwark"]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close enemy inspection" }));
    expect(audio.playMusic).toHaveBeenCalledOnce();
    fireEvent.click(portrait);
    expect(screen.getByRole("dialog", { name: "The Forge Golem" })).toBeTruthy();
    expect(audio.playMusic).toHaveBeenCalledOnce();
    expect(audio.playEnemyAttack).toHaveBeenCalledTimes(2);
  });

  it("keeps undiscovered entries concealed while retaining their existing click sound", () => {
    render(<CollectionScreen {...defaultProps} collectionTab="bestiary" encounteredEnemyIds={[]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Inspect Undiscovered Entry" })[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(audio.playEnemyAttack).toHaveBeenCalledOnce();
  });
});
