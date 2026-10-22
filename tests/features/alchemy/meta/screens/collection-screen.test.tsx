import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionScreen } from "@/features/alchemy/meta/screens/collection-screen";
import { installReadyArtworkForTests } from "../../../../helpers/artwork-test";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
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

  it("reveals a newly discovered card's authored description without remounting Collection", () => {
    const { rerender } = render(<CollectionScreen {...defaultProps} discoveredCardIds={[]} />);
    expect(screen.queryByRole("button", { name: "Inspect Anvil" })).toBeNull();
    rerender(<CollectionScreen {...defaultProps} discoveredCardIds={["anvil"]} />);
    const anvil = screen.getByRole("button", { name: "Inspect Anvil" });
    fireEvent.mouseEnter(anvil.parentElement!);
    expect(screen.getByRole("tooltip").textContent).toMatch(/Gain \d+ Forge/);
    fireEvent.click(anvil);
    expect(audio.playCardSound).toHaveBeenCalledExactlyOnceWith("anvil");
  });

  it("does not reveal an undiscovered card through its sound", () => {
    render(<CollectionScreen {...defaultProps} discoveredCardIds={[]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Inspect Undiscovered Entry" })[0]!);
    expect(audio.playCardSound).not.toHaveBeenCalled();
  });
});
