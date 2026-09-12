import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CollectionScreen } from "@/features/alchemy/meta/screens/collection-screen";
import type { CollectionTab } from "@/features/alchemy/shared/types";

const sizing = vi.hoisted(() => ({ pageSize: 8 }));
vi.mock("@/features/alchemy/shared/ui/adaptive-grid", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/alchemy/shared/ui/adaptive-grid")>()),
  useAdaptiveGrid: () => ({ pageSize: sizing.pageSize, columns: sizing.pageSize / 2, referenceTileWidth: 244.512 }),
}));
vi.mock("@/features/alchemy/meta/screens/collection/collection-ui", () => ({
  CollectionGrid: ({ page }: { page: number }) => <output data-testid="page">{page}</output>,
  CollectionTabs: () => null,
  CollectionPagination: () => null,
}));
vi.mock("@/features/alchemy/meta/screens/collection/collection-items", () => ({
  getCollectionLibraryLength: () => 40,
}));

const onPageChange = vi.fn();
function CollectionHarness() {
  const [collectionTab, setTab] = useState<CollectionTab>("cards");
  const [collectionPages, setPages] = useState({ heroes: 0, cards: 2, bestiary: 0, trinkets: 0, uniques: 0 });
  return (
    <>
      <button onClick={() => setTab(collectionTab === "cards" ? "trinkets" : "cards")}>Switch tab</button>
      <button onClick={() => setPages((pages) => ({ ...pages, cards: 0 }))}>Reset page</button>
      <CollectionScreen
        collectionTab={collectionTab}
        collectionPages={collectionPages}
        onSelectTab={setTab}
        onPageChange={(tab, page) => {
          onPageChange(tab, page);
          setPages((pages) => ({ ...pages, [tab]: page }));
        }}
        discoveredCardIds={[]}
        encounteredEnemyIds={[]}
        discoveredTrinketIds={[]}
        discoveredUniqueIds={[]}
        finishedRunCharacters={[]}
        bondedCompanions={{}}
      />
    </>
  );
}

beforeEach(() => {
  sizing.pageSize = 8;
  onPageChange.mockClear();
});
afterEach(cleanup);

it("remembers the resized page through a tab round trip and reports it once", () => {
  const { rerender } = render(<CollectionHarness />);
  expect(screen.getByTestId("page").textContent).toBe("2");
  sizing.pageSize = 10;
  rerender(<CollectionHarness />);
  expect(screen.getByTestId("page").textContent).toBe("1");
  expect(onPageChange).toHaveBeenCalledExactlyOnceWith("cards", 1);
  fireEvent.click(screen.getByText("Switch tab"));
  fireEvent.click(screen.getByText("Switch tab"));
  expect(screen.getByTestId("page").textContent).toBe("1");
  expect(onPageChange).toHaveBeenCalledTimes(1);
});

it("honors a parent page change without switching tabs", () => {
  render(<CollectionHarness />);
  fireEvent.click(screen.getByText("Reset page"));
  expect(screen.getByTestId("page").textContent).toBe("0");
  expect(onPageChange).not.toHaveBeenCalled();
});
