import { installFocusInputForTests } from "../../../../../helpers/focus-input-test";
import { sortInspectionCards } from "@/features/alchemy/shared/ui/inspection/card-inspection-sort";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardInspectionOverlay } from "@/features/alchemy/shared/ui/inspection/card-inspection-overlay";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { makeTestCard } from "../../../../../fixtures/battle";
import { installDisabledAnimationsForTests } from "../../../../../helpers/animation-test";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../../helpers/artwork-test";
import { installCatalogs, localization } from "@/lib/localization/runtime";
import catalogs from "@/lib/localization/locales/runtime.json";

installFocusInputForTests(true);

installDisabledAnimationsForTests();
installReadyArtworkForTests();
beforeEach(() => {
  // jsdom has no geometry; focus eligibility still needs visible-control bounds.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    new DOMRect(0, 0, 100, 30),
  ] as unknown as DOMRectList);
  HTMLElement.prototype.scrollIntoView = vi.fn();
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
  vi.restoreAllMocks();
  resetEscapeStackForTests();
});

const alpha = makeTestCard({ id: "alpha", title: "Alpha", uid: 1 });
const beta = makeTestCard({ id: "beta", title: "Beta", uid: 2 });
const props = {
  open: true,
  selected: "deck" as const,
  collections: [{ id: "deck" as const, cards: [beta, alpha, { ...alpha, uid: 3 }] }],
  descriptionContext: {},
  onClose: vi.fn(),
};

describe("card inspection", () => {
  it("reorders translated titles using Spanish and Chinese collation without remounting or changing cards", async () => {
    installCatalogs({
      version: 1,
      languages: ["en", "es", "zh-Hans"],
      aliases: {},
      messages: {
        "test.first": ["First custom card", "ñandú", "阿"],
        "test.second": ["Second custom card", "nube", "八"],
      },
    });
    const cards = Object.freeze([
      makeTestCard({ title: "First custom card", uid: 30 }),
      makeTestCard({ title: "Second custom card", uid: 31 }),
    ]);
    const before = JSON.stringify(cards);
    try {
      render(<CardInspectionOverlay {...props} collections={[{ id: "deck", cards: [...cards] }]} />);
      await waitForArtwork();
      const close = screen.getByRole("button", { name: "Close card inspection" });
      await waitFor(() => expect(document.activeElement).toBe(close));
      const grid = screen.getByTestId("card-selection-grid");
      const titles = () =>
        within(grid)
          .getAllByRole("img")
          .map((image) => image.getAttribute("alt"));
      expect(titles()).toEqual(["First custom card", "Second custom card"]);
      await act(async () => {
        await localization.changeLanguage("es");
      });
      expect(titles()).toEqual(["nube", "ñandú"]);
      await act(async () => {
        await localization.changeLanguage("zh-Hans");
      });
      expect(titles()).toEqual(["阿", "八"]);
      expect(screen.getByTestId("card-selection-grid")).toBe(grid);
      expect(document.activeElement).toBe(close);
      expect(JSON.stringify(cards)).toBe(before);
    } finally {
      installCatalogs(catalogs);
      await act(async () => {
        await localization.changeLanguage("en");
      });
    }
  });

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

  it("renders each copy and focuses the close button", async () => {
    render(<CardInspectionOverlay {...props} />);
    const grid = screen.getByTestId("card-selection-grid");
    expect(
      within(grid)
        .getAllByRole("img")
        .map((img) => img.getAttribute("alt")),
    ).toEqual(["Alpha", "Alpha", "Beta"]);
    expect(screen.getByRole("heading", { name: "Deck" })).toBeTruthy();
    expect(grid.querySelector("p.mt-2")).toBeNull();
    expect(screen.getByRole("dialog").hasAttribute("aria-describedby")).toBe(false);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close card inspection" })),
    );
    expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  });

  it("labels an empty pile and keeps its close action available", () => {
    render(
      <CardInspectionOverlay
        {...props}
        selected="discard"
        collections={[...props.collections, { id: "draw", cards: [beta] }, { id: "discard", cards: [] }]}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Discard Pile" })).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByRole("img", { name: "Empty Discard Pile" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Card collections" })).toBeNull();
    expect(screen.queryByRole("button", { name: /cards$/ })).toBeNull();
    expect(screen.queryByTestId("card-selection-grid")).toBeNull();
  });

  it("shows only the selected pile without collection tabs", () => {
    render(
      <CardInspectionOverlay
        {...props}
        selected="draw"
        collections={[...props.collections, { id: "draw", cards: [beta] }, { id: "discard", cards: [] }]}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Draw Pile" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /cards$/ })).toBeNull();
    expect(
      within(screen.getByTestId("card-selection-grid"))
        .getAllByRole("img")
        .map((img) => img.getAttribute("alt")),
    ).toEqual(["Beta"]);
  });

  it("contains keyboard focus and dismisses without restoring focus after Escape", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const onClose = vi.fn();
    const view = render(<CardInspectionOverlay {...props} onClose={onClose} />);
    const close = screen.getByRole("button", { name: "Close card inspection" });
    await waitForArtwork();
    await waitFor(() => expect(document.activeElement).toBe(close));
    opener.focus();
    expect(document.activeElement).toBe(close);
    fireEvent.click(screen.getByTestId("card-selection-grid"));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.setup().keyboard("{Escape}");
    fireEvent.click(screen.getByTestId("card-inspection-overlay"));
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(3);
    view.unmount();
    expect(document.activeElement).toBe(document.body);
    opener.remove();
  });

  it("resets pagination on collection changes and reopen, and rejects closing-fade clicks", async () => {
    const many = Array.from({ length: 40 }, (_, uid) => ({ ...alpha, uid }));
    const collections = [
      { id: "deck" as const, cards: many },
      { id: "draw" as const, cards: [beta] },
    ];
    const onClose = vi.fn();
    const view = render(<CardInspectionOverlay {...props} collections={collections} onClose={onClose} />);
    await waitForArtwork();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Previous page" })).toHaveProperty("disabled", false),
    );
    view.rerender(<CardInspectionOverlay {...props} selected="draw" collections={collections} onClose={onClose} />);
    await waitForArtwork();
    view.rerender(<CardInspectionOverlay {...props} collections={collections} onClose={onClose} />);
    await waitForArtwork();
    await waitFor(() => expect(screen.getByRole("button", { name: "Previous page" })).toHaveProperty("disabled", true));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    view.rerender(<CardInspectionOverlay {...props} open={false} collections={collections} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close card inspection" }));
    expect(onClose).not.toHaveBeenCalled();
    view.rerender(<CardInspectionOverlay {...props} collections={collections} onClose={onClose} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Previous page" })).toHaveProperty("disabled", true));
  });
});
