import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollectionScreen } from "@/features/alchemy/meta/screens/collection-screen";
import { MUSIC_KEYS } from "@/lib/game-constants";
import { endBossPreview, previewBossMusic } from "@/lib/audio";

vi.mock("@/lib/audio", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio")>()),
  previewBossMusic: vi.fn(),
  endBossPreview: vi.fn(),
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

it("forwards every boss activation to the preview; the module dedupes repeats", () => {
  render(<CollectionScreen {...props} />);
  for (const [id, key] of [
    ["forge-golem", MUSIC_KEYS.BOSS_FORGE_GOLEM],
    ["frostwarden", MUSIC_KEYS.BOSS_FROSTWARDEN],
    ["blight-treant", MUSIC_KEYS.BOSS_BLIGHT_TREANT],
    ["iron-bear", MUSIC_KEYS.BOSS_IRON_BEAR],
  ]) {
    fireEvent.click(screen.getByRole("button", { name: id }));
    expect(previewBossMusic).toHaveBeenLastCalledWith(key);
    fireEvent.click(screen.getByRole("button", { name: id }));
  }
  // Repeat clicks forward too; previewBossMusic() itself skips the restart
  // (pinned in music.dom.test.ts).
  expect(previewBossMusic).toHaveBeenCalledTimes(8);
  fireEvent.click(screen.getByRole("button", { name: "unknown-boss" }));
  fireEvent.click(screen.getByRole("button", { name: "goblin-scout" }));
  expect(previewBossMusic).toHaveBeenCalledTimes(8);
});

it("ends the preview on page and tab changes", () => {
  const { rerender } = render(<CollectionScreen {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "forge-golem" }));
  expect(previewBossMusic).toHaveBeenCalledTimes(1);

  vi.mocked(endBossPreview).mockClear();
  rerender(<CollectionScreen {...props} collectionPages={{ ...props.collectionPages, bestiary: 1 }} />);
  expect(endBossPreview).toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "forge-golem" }));
  expect(previewBossMusic).toHaveBeenCalledTimes(2);
  vi.mocked(endBossPreview).mockClear();
  rerender(<CollectionScreen {...props} collectionTab="cards" />);
  expect(endBossPreview).toHaveBeenCalled();
});

it("leaves destination music selection to app navigation on unmount", () => {
  const { unmount } = render(<CollectionScreen {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "forge-golem" }));
  vi.mocked(previewBossMusic).mockClear();
  vi.mocked(endBossPreview).mockClear();
  unmount();
  expect(previewBossMusic).not.toHaveBeenCalled();
  expect(endBossPreview).not.toHaveBeenCalled();
});

it("never previews unknown enemies; tab restore without a preview is a music no-op", () => {
  const { rerender } = render(<CollectionScreen {...props} />);
  vi.clearAllMocks();
  fireEvent.click(screen.getByRole("button", { name: "unknown-boss" }));
  expect(previewBossMusic).not.toHaveBeenCalled();
  // The tab change still runs the restore path, but endBossPreview() no-ops
  // internally without an active preview (pinned in music.dom.test.ts).
  rerender(<CollectionScreen {...props} collectionTab="cards" />);
  expect(previewBossMusic).not.toHaveBeenCalled();
  expect(endBossPreview).toHaveBeenCalledTimes(1);
});
