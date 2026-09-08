import { sortInspectionCards } from "@/features/alchemy/shared/ui/card-inspection-sort";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardInspectionOverlay } from "@/features/alchemy/shared/ui/card-inspection-overlay";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { makeTestCard } from "../../../../fixtures/battle";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

installDisabledAnimationsForTests();
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetEscapeStackForTests();
});

const alpha = makeTestCard({ id: "alpha", title: "Alpha", uid: 1 });
const beta = makeTestCard({ id: "beta", title: "Beta", uid: 2 });
const props = {
  open: true,
  selected: "deck" as const,
  collections: [{ id: "deck" as const, cards: [beta, alpha, { ...alpha, uid: 3 }] }],
  descriptionContext: {},
  onSelect: vi.fn(),
  onClose: vi.fn(),
};

describe("card inspection", () => {
  it("sorts copies without revealing input order or discarding card modifications", () => {
    const corrupted = { ...alpha, uid: 4, corrupted: true, descriptionLines: ["Deal 12 Physical damage"] };
    const mixed = makeTestCard({
      id: "mixed-potion",
      title: "Mixed Potion",
      uid: 5,
      cost: 2,
      effects: [{ kind: "heal", amount: 11 }],
      descriptionLines: ["Restore 11 Health"],
    });
    const cards = Object.freeze([mixed, corrupted, beta, alpha, { ...alpha, uid: 6 }]);
    const original = [...cards];
    const sorted = sortInspectionCards(cards);
    expect(sorted).toEqual(sortInspectionCards([...cards].reverse()));
    expect(cards).toEqual(original);
    expect(sorted).toHaveLength(5);
    expect(sorted).toContain(corrupted);
    expect(sorted).toContain(mixed);
  });

  it("renders each copy and focuses the close button", () => {
    render(<CardInspectionOverlay {...props} />);
    const grid = screen.getByTestId("card-selection-grid");
    expect(
      within(grid)
        .getAllByRole("img")
        .map((img) => img.getAttribute("alt")),
    ).toEqual(["Alpha", "Alpha", "Beta"]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close card inspection" }));
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it("shows empty piles and their own counts", () => {
    render(
      <CardInspectionOverlay
        {...props}
        selected="discard"
        collections={[...props.collections, { id: "draw", cards: [beta] }, { id: "discard", cards: [] }]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Discard Pile · 0 cards" })).toBeTruthy();
    expect(screen.getByText("No cards here.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Draw Pile · 1" }));
    expect(props.onSelect).toHaveBeenCalledWith("draw");
  });

  it("contains focus, supports every dismissal route, and restores the opener", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const onClose = vi.fn();
    const view = render(<CardInspectionOverlay {...props} onClose={onClose} />);
    const close = screen.getByRole("button", { name: "Close card inspection" });
    opener.focus();
    expect(document.activeElement).toBe(close);
    fireEvent.click(screen.getByTestId("card-selection-grid"));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.setup().keyboard("{Escape}");
    fireEvent.click(screen.getByTestId("card-inspection-overlay"));
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(3);
    view.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("resets pagination on reopen and rejects clicks during the closing fade", async () => {
    const many = Array.from({ length: 40 }, (_, uid) => ({ ...alpha, uid }));
    const collections = [{ id: "deck" as const, cards: many }];
    const onClose = vi.fn();
    const view = render(<CardInspectionOverlay {...props} collections={collections} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Previous page" })).toHaveProperty("disabled", false),
    );
    view.rerender(<CardInspectionOverlay {...props} open={false} collections={collections} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close card inspection" }));
    expect(onClose).not.toHaveBeenCalled();
    view.rerender(<CardInspectionOverlay {...props} collections={collections} onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Previous page" })).toHaveProperty("disabled", true));
  });
});
