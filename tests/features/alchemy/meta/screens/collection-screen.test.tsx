import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionScreen } from "@/features/alchemy/meta/screens/collection-screen";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../helpers/artwork-test";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { boardCatalog, type BoardSelection } from "@/lib/boards/catalog";
import { enemyBestiary } from "@/lib/game-data";
import { getBossMusicKey } from "@/lib/audio";

const audio = vi.hoisted(() => ({
  playMusic: vi.fn(),
  playCardSound: vi.fn(),
  playUISound: vi.fn(),
  playBattleEvent: vi.fn(),
  previewBossMusic: vi.fn(),
  endBossPreview: vi.fn(),
}));
vi.mock("@/lib/audio", async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), ...audio }));

installReadyArtworkForTests();

describe("CollectionScreen", () => {
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    collectedBoardIds: ["acorn"],
    boardSelection: { kind: "board" as const, boardId: "acorn" },
    onSelectBoard: vi.fn(() => true),
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
      boards: 0,
    },
    onPageChange: vi.fn(),
    bondedCompanions: {},
  };

  it("opens Boss inspection while preserving music preview across closing and reopening", () => {
    const id = "forge-golem";
    const sorted = [...enemyBestiary].sort((a, b) => a.title.localeCompare(b.title));
    const page = Math.floor(sorted.findIndex((entry) => entry.id === id) / 6);
    const props = {
      ...defaultProps,
      collectionTab: "bestiary" as const,
      encounteredEnemyIds: [id],
      collectionPages: { ...defaultProps.collectionPages, bestiary: page },
    };
    const { rerender, unmount } = render(<CollectionScreen {...props} />);
    const portrait = screen.getByRole("button", { name: "Inspect The Forge Golem" });
    fireEvent.click(portrait);
    expect(audio.playCardSound).not.toHaveBeenCalled();
    expect(audio.playUISound).not.toHaveBeenCalled();
    expect(audio.playBattleEvent).not.toHaveBeenCalled();
    expect(audio.previewBossMusic).toHaveBeenCalledWith(getBossMusicKey(id));
    const dialog = screen.getByRole("dialog", { name: "The Forge Golem" });
    expect(
      within(dialog)
        .getAllByRole("img")
        .map((image) => image.getAttribute("alt")),
    ).toEqual(["Sunder", "Bash", "Molten Bulwark"]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close enemy inspection" }));
    expect(audio.previewBossMusic).toHaveBeenCalledTimes(1);
    fireEvent.click(portrait);
    expect(screen.getByRole("dialog", { name: "The Forge Golem" })).toBeTruthy();
    expect(audio.previewBossMusic).toHaveBeenCalledTimes(2);
    expect(audio.previewBossMusic).toHaveBeenLastCalledWith(getBossMusicKey(id));
    expect(audio.playCardSound).not.toHaveBeenCalled();
    expect(audio.playUISound).not.toHaveBeenCalled();
    expect(audio.playBattleEvent).not.toHaveBeenCalled();
    audio.endBossPreview.mockClear();
    rerender(<CollectionScreen {...props} collectionPages={{ ...props.collectionPages, bestiary: page + 1 }} />);
    expect(audio.endBossPreview).toHaveBeenCalledOnce();
    rerender(<CollectionScreen {...props} collectionTab="cards" />);
    expect(audio.endBossPreview).toHaveBeenCalledTimes(2);
    audio.previewBossMusic.mockClear();
    unmount();
    expect(audio.previewBossMusic).not.toHaveBeenCalled();
    expect(audio.endBossPreview).toHaveBeenCalledTimes(2);
  });

  it("keeps an undiscovered Boss silent while allowing a discovered Boss preview", () => {
    const sorted = [...enemyBestiary].sort((a, b) => a.title.localeCompare(b.title));
    const index = sorted.findIndex((entry) => entry.id === "forge-golem");
    const props = {
      ...defaultProps,
      collectionTab: "bestiary" as const,
      encounteredEnemyIds: [],
      collectionPages: { ...defaultProps.collectionPages, bestiary: Math.floor(index / 6) },
    };
    const { rerender } = render(<CollectionScreen {...props} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Inspect Undiscovered Entry" })[index % 6]!);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(audio.previewBossMusic).not.toHaveBeenCalled();
    rerender(<CollectionScreen {...props} encounteredEnemyIds={["forge-golem"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Inspect The Forge Golem" }));
    expect(audio.previewBossMusic).toHaveBeenCalledWith(getBossMusicKey("forge-golem"));
  });

  it("does not reveal an undiscovered card through its sound", () => {
    render(<CollectionScreen {...defaultProps} discoveredCardIds={[]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Inspect Undiscovered Entry" })[0]!);
    expect(audio.playCardSound).not.toHaveBeenCalled();
  });
});

describe("Game Boards", () => {
  installDisabledAnimationsForTests();
  afterEach(cleanup);

  function boardProps(boardSelection: BoardSelection = { kind: "none" }) {
    return {
      collectionTab: "boards" as const,
      collectedBoardIds: ["acorn"],
      boardSelection,
      onSelectBoard: vi.fn(() => true),
      onSelectTab: vi.fn(),
      discoveredCardIds: [],
      encounteredEnemyIds: [],
      discoveredTrinketIds: [],
      discoveredUniqueIds: [],
      finishedRunCharacters: [],
      collectionPages: { heroes: 0, cards: 0, bestiary: 0, trinkets: 0, uniques: 0, boards: 0 },
      onPageChange: vi.fn(),
      bondedCompanions: {},
    };
  }

  it("selects None and Random immediately through the existing board commands", async () => {
    const props = boardProps();
    const { rerender } = render(<CollectionScreen {...props} />);
    await waitForArtwork();
    expect(screen.getByRole("button", { name: "None" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(4);
    expect(screen.queryByText(/collected/i)).toBeNull();
    expect(screen.queryByText("Acorn")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Random" }));
    expect(props.onSelectBoard).toHaveBeenCalledExactlyOnceWith({ kind: "random" });
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<CollectionScreen {...props} boardSelection={{ kind: "random" }} />);
    expect(screen.getByRole("button", { name: "Random" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: "None" }).hasAttribute("aria-current")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect(props.onSelectBoard).toHaveBeenLastCalledWith({ kind: "none" });
    rerender(<CollectionScreen {...props} boardSelection={{ kind: "board", boardId: "acorn" }} />);
    expect(screen.getByRole("button", { name: "Inspect Acorn" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: "Random" }).hasAttribute("aria-current")).toBe(false);
  });

  it("keeps locked inspection, collected-board equipping, and return focus", async () => {
    const props = boardProps();
    render(<CollectionScreen {...props} />);
    await waitForArtwork();
    const locked = screen.getByRole("button", { name: "Inspect Alpine Cuckoo (Locked)" });
    locked.focus();
    fireEvent.click(locked);
    const dialog = screen.getByRole("dialog", { name: "Alpine Cuckoo" });
    expect(within(dialog).getByRole("img", { name: "Alpine Cuckoo" })).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Use Board" })).toBeNull();
    await waitForArtwork();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close board inspection" }));
    await waitFor(() => expect(document.activeElement).toBe(locked));

    const owned = screen.getByRole("button", { name: "Inspect Acorn" });
    owned.focus();
    fireEvent.click(owned);
    await waitForArtwork();
    fireEvent.click(screen.getByRole("button", { name: "Use Board" }));
    expect(props.onSelectBoard).toHaveBeenCalledExactlyOnceWith({ kind: "board", boardId: "acorn" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(owned);
  });

  it("paginates the combined choices without skipping boards and preserves tab page memory", async () => {
    const props = boardProps();
    const { rerender } = render(<CollectionScreen {...props} />);
    await waitForArtwork();
    expect(screen.getAllByRole("button", { name: /^Inspect / }).map((tile) => tile.getAttribute("aria-label"))).toEqual(
      boardCatalog.slice(0, 4).map((board) => `Inspect ${board.title}${board.id === "acorn" ? "" : " (Locked)"}`),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(props.onPageChange).toHaveBeenCalledExactlyOnceWith("boards", 1);
    rerender(<CollectionScreen {...props} collectionPages={{ ...props.collectionPages, boards: 1 }} />);
    await waitFor(() => expect(screen.queryByRole("button", { name: "None" })).toBeNull());
    expect(screen.getAllByRole("button", { name: /^Inspect / }).map((tile) => tile.getAttribute("aria-label"))).toEqual(
      boardCatalog.slice(4, 10).map((board) => `Inspect ${board.title} (Locked)`),
    );
    rerender(
      <CollectionScreen {...props} collectionTab="cards" collectionPages={{ ...props.collectionPages, boards: 1 }} />,
    );
    rerender(<CollectionScreen {...props} collectionPages={{ ...props.collectionPages, boards: 1 }} />);
    await waitForArtwork();
    expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(6);
    expect(screen.queryByRole("button", { name: "Random" })).toBeNull();

    const lastPage = Math.floor((boardCatalog.length + 1) / 6);
    rerender(<CollectionScreen {...props} collectionPages={{ ...props.collectionPages, boards: lastPage }} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Next page" }).hasAttribute("disabled")).toBe(true));
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /^Inspect / }).map((tile) => tile.getAttribute("aria-label")),
      ).toEqual(boardCatalog.slice(lastPage * 6 - 2).map((board) => `Inspect ${board.title} (Locked)`)),
    );
  });
});
