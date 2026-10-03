import { useState } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArmoryInventoryControls } from "@/features/alchemy/meta/screens/armory/armory-inventory-controls";
import { DEFAULT_ARMORY_INVENTORY_FILTERS } from "@/features/alchemy/meta/screens/armory/armory-inventory-filtering";

function Harness({ onSort = vi.fn(), isTrinket = false }) {
  const [filters, setFilters] = useState(DEFAULT_ARMORY_INVENTORY_FILTERS);
  return (
    <section data-testid="armory-right-panel">
      <ArmoryInventoryControls
        filters={filters}
        isTrinket={isTrinket}
        onFiltersChange={setFilters}
        onSort={onSort}
        onBrowse={() => {}}
      />
      <button>Outside inventory</button>
      <output aria-label="Current criteria">{JSON.stringify(filters)}</output>
    </section>
  );
}

describe("Armory inventory toolbar", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      new DOMRect(0, 0, 44, 44),
    ] as unknown as DOMRectList);
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  it("clears and collapses search with focus restored, while clearing filters preserves search", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const searchTrigger = screen.getByRole("button", { name: "Search inventory" });
    await user.click(searchTrigger);
    const input = screen.getByRole("searchbox", { name: "Search inventory" });
    expect(document.activeElement).toBe(input);
    await user.type(input, "longsword");
    await user.click(screen.getByRole("button", { name: "Filters" }));
    let filter = await screen.findByRole("dialog", { name: "Inventory filters" });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(filter).getByRole("button", { name: "Close inventory filters" })),
    );
    await user.click(within(filter).getByRole("button", { name: "Astral" }));
    await user.click(within(filter).getByRole("checkbox", { name: "Physical" }));
    expect(JSON.parse(screen.getByLabelText("Current criteria").textContent!)).toEqual({
      search: "longsword",
      rarities: ["astral"],
      keywords: ["physical"],
    });
    await user.keyboard("{Escape}");
    const filterTrigger = screen.getByRole("button", { name: "Filters" });
    expect(filterTrigger.classList.contains("bg-muted")).toBe(true);
    await user.click(filterTrigger);
    filter = await screen.findByRole("dialog", { name: "Inventory filters" });
    await user.click(within(filter).getByRole("button", { name: "Clear filters" }));
    expect(input.getAttribute("value")).toBe("longsword");
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Filters" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(filterTrigger.classList.contains("bg-muted")).toBe(false);
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(searchTrigger);
    expect(searchTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(JSON.parse(screen.getByLabelText("Current criteria").textContent!).search).toBe("");
    await user.click(searchTrigger);
    await user.type(input, "hatchet");
    await user.click(screen.getByRole("button", { name: "Close inventory search" }));
    expect(document.activeElement).toBe(searchTrigger);
    expect(JSON.parse(screen.getByLabelText("Current criteria").textContent!).search).toBe("");
  });

  it("switches menus, dispatches Base Type sorting, and dismisses without stealing outside focus", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(<Harness onSort={onSort} />);
    await user.click(screen.getByRole("button", { name: "Filters" }));
    await screen.findByRole("dialog", { name: "Inventory filters" });
    const sortTrigger = screen.getByRole("button", { name: "Sort inventory" });
    await user.click(sortTrigger);
    const sort = await screen.findByRole("dialog", { name: "Sort inventory" });
    expect(screen.queryByRole("dialog", { name: "Inventory filters" })).toBeNull();
    await user.click(within(sort).getByRole("button", { name: "Base Type" }));
    expect(onSort).toHaveBeenCalledExactlyOnceWith("base-type");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(sortTrigger);
    await user.click(sortTrigger);
    await screen.findByRole("dialog", { name: "Sort inventory" });
    await user.click(screen.getByRole("button", { name: "Outside inventory" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Outside inventory" }));
    await user.click(sortTrigger);
    await screen.findByRole("dialog", { name: "Sort inventory" });
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(sortTrigger);
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(sortTrigger);
    const reopened = await screen.findByRole("dialog", { name: "Sort inventory" });
    within(reopened).getByRole("button", { name: "Base Type" }).focus();
    await user.tab();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Outside inventory" }));
  });
});
