import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardSelectionGrid } from "@/features/alchemy/shared/ui/card-selection-grid";
import { cardLibrary } from "@/lib/game-data";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

const sizing = vi.hoisted(() => ({ pageSize: 8 }));
vi.mock("@/features/alchemy/shared/ui/adaptive-grid", () => ({
  useAdaptiveGrid: () => ({ pageSize: sizing.pageSize, columns: sizing.pageSize / 2, referenceTileWidth: 230.472 }),
}));

installDisabledAnimationsForTests();
afterEach(cleanup);
beforeEach(() => {
  sizing.pageSize = 8;
});
const onPageChange = vi.fn();
const onSelect = vi.fn();
const items = Array.from({ length: 30 }, (_, index) => ({ card: cardLibrary[0]!, index: index * 2 }));

function Picker({ count = 30 }: { count?: number }) {
  const [page, setPage] = useState(2);
  return (
    <CardSelectionGrid
      items={items.slice(0, count)}
      page={page}
      selectedIndex={19}
      onPageChange={(next) => {
        onPageChange(next);
        setPage(next);
      }}
      renderItem={({ index }) => <button onClick={() => onSelect(index)}>Card {index}</button>}
    />
  );
}

it("keeps a selected filtered entry visible on resize and reports its original deck index", () => {
  onPageChange.mockClear();
  const { rerender } = render(<Picker />);
  expect(screen.getByRole("button", { name: "Card 38" })).toBeTruthy();
  sizing.pageSize = 6;
  rerender(<Picker />);
  expect(onPageChange).toHaveBeenCalledExactlyOnceWith(3);
  fireEvent.click(screen.getByRole("button", { name: "Card 38" }));
  expect(onSelect).toHaveBeenCalledWith(38);
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
  expect(screen.getByRole("button", { name: "Card 24" })).toBeTruthy();
});

it("clamps a shrinking card list without returning to the removed page on growth", async () => {
  const { rerender } = render(<Picker />);
  rerender(<Picker count={4} />);
  expect(await screen.findByRole("button", { name: "Card 0" })).toBeTruthy();
  rerender(<Picker />);
  expect(await screen.findByRole("button", { name: "Card 0" })).toBeTruthy();
});

it("keeps fixed offered choices together and tolerates an empty choice list", () => {
  const renderItem = ({ index }: { index: number }) => <button>Card {index}</button>;
  const { rerender } = render(
    <CardSelectionGrid items={items} page={0} pageSize={items.length} onPageChange={vi.fn()} renderItem={renderItem} />,
  );
  sizing.pageSize = 6;
  rerender(
    <CardSelectionGrid items={items} page={0} pageSize={items.length} onPageChange={vi.fn()} renderItem={renderItem} />,
  );
  expect(screen.getAllByRole("button")).toHaveLength(30);
  rerender(
    <CardSelectionGrid
      items={[]}
      page={0}
      pageSize={0}
      onPageChange={vi.fn()}
      renderItem={renderItem}
      emptyMessage="Empty choices"
    />,
  );
  expect(screen.getByText("Empty choices")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});
