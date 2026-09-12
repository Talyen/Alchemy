import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollectionScreen } from "@/features/alchemy/meta/screens/collection-screen";
import { MUSIC_KEYS } from "@/lib/game-constants";
import { playMusic } from "@/lib/audio";

vi.mock("@/lib/audio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio")>()),
  playMusic: vi.fn(),
}));
vi.mock("@/features/alchemy/meta/screens/collection/collection-ui", () => ({
  CollectionGrid: ({ onEnemyActivate }: { onEnemyActivate: (id: string) => void }) => (
    <>
      {["forge-golem", "frostwarden", "blight-treant", "iron-bear", "unknown-boss", "goblin-scout"].map((id) => (
        <button key={id} onClick={() => onEnemyActivate(id)}>
          {id}
        </button>
      ))}
    </>
  ),
  CollectionTabs: () => null,
  CollectionPagination: () => null,
}));

const props = {
  collectionTab: "bestiary" as const,
  onSelectTab: vi.fn(),
  collectionPages: { heroes: 0, cards: 0, bestiary: 0, trinkets: 0, uniques: 0 },
  onPageChange: vi.fn(),
  discoveredCardIds: [],
  encounteredEnemyIds: [],
  discoveredTrinketIds: [],
  discoveredUniqueIds: [],
  finishedRunCharacters: [],
  bondedCompanions: {},
};

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it("switches between registered boss tracks without restarting the same selection", () => {
  render(<CollectionScreen {...props} />);
  for (const [id, key] of [
    ["forge-golem", MUSIC_KEYS.BOSS_FORGE_GOLEM],
    ["frostwarden", MUSIC_KEYS.BOSS_FROSTWARDEN],
    ["blight-treant", MUSIC_KEYS.BOSS_BLIGHT_TREANT],
    ["iron-bear", MUSIC_KEYS.BOSS_IRON_BEAR],
  ]) {
    fireEvent.click(screen.getByRole("button", { name: id }));
    expect(playMusic).toHaveBeenLastCalledWith(key);
    fireEvent.click(screen.getByRole("button", { name: id }));
  }
  expect(playMusic).toHaveBeenCalledTimes(4);
  fireEvent.click(screen.getByRole("button", { name: "unknown-boss" }));
  fireEvent.click(screen.getByRole("button", { name: "goblin-scout" }));
  expect(playMusic).toHaveBeenCalledTimes(4);
});

it("restores menu music on page and tab changes without restarting on return", () => {
  const { rerender } = render(<CollectionScreen {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "forge-golem" }));
  rerender(<CollectionScreen {...props} collectionPages={{ ...props.collectionPages, bestiary: 1 }} />);
  expect(playMusic).toHaveBeenLastCalledWith(MUSIC_KEYS.MENU);
  rerender(<CollectionScreen {...props} />);
  expect(playMusic).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "forge-golem" }));
  rerender(<CollectionScreen {...props} collectionTab="cards" />);
  expect(playMusic).toHaveBeenLastCalledWith(MUSIC_KEYS.MENU);
  rerender(<CollectionScreen {...props} />);
  expect(playMusic).toHaveBeenCalledTimes(4);
});

it("leaves destination music selection to app navigation on unmount", () => {
  const { unmount } = render(<CollectionScreen {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "forge-golem" }));
  vi.mocked(playMusic).mockClear();
  unmount();
  expect(playMusic).not.toHaveBeenCalled();
});

it("does not change music when browsing without a preview", () => {
  const { rerender } = render(<CollectionScreen {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "unknown-boss" }));
  rerender(<CollectionScreen {...props} collectionTab="cards" />);
  expect(playMusic).not.toHaveBeenCalled();
});
