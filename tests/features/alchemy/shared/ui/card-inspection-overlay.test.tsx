import { sortInspectionCards } from "@/features/alchemy/shared/ui/card-inspection-sort";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardInspectionOverlay } from "@/features/alchemy/shared/ui/card-inspection-overlay";
import { keywordDefinitions } from "@/lib/game-data";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { makeTestCard } from "../../../../fixtures/battle";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../helpers/artwork-test";

installDisabledAnimationsForTests();
installReadyArtworkForTests();
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
    expect(screen.getByRole("heading", { name: "Discard Pile" })).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText("Empty")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Card collections" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByTestId("card-selection-grid")).toBeNull();
  });

  it("contains focus, supports every dismissal route, and restores the opener", async () => {
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
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("shows hover-only keyword shine, with neutral fallback when no keywords resolve", () => {
    const keywordCard = makeTestCard({
      id: "physical-slash",
      title: "Physical Slash",
      uid: 11,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const plainCard = makeTestCard({ id: "plain", title: "Plain", uid: 12, effects: [], descriptionLines: [] });
    render(
      <CardInspectionOverlay {...props} collections={[{ id: "deck" as const, cards: [keywordCard, plainCard] }]} />,
    );
    const keywordButton = screen.getByRole("button", { name: "Physical Slash" });
    const plainButton = screen.getByRole("button", { name: "Plain" });
    expect(keywordButton.querySelector(".shine-border")).toBeNull();
    expect(plainButton.querySelector(".shine-border")).toBeNull();
    fireEvent.mouseEnter(keywordButton.parentElement!);
    const shine = keywordButton.querySelector<HTMLElement>(".shine-border")!;
    expect(shine).not.toBeNull();
    expect(keywordButton.className).toMatch(/card-art-shine/);
    const color = document.createElement("span");
    color.style.color = keywordDefinitions.physical.shineColors[0]!;
    expect(shine.querySelector<HTMLElement>(".shine-border-paint")!.style.backgroundImage).toContain(color.style.color);
    fireEvent.mouseLeave(keywordButton.parentElement!);
    expect(keywordButton.querySelector(".shine-border")).toBeNull();
    fireEvent.focus(plainButton);
    expect(plainButton.querySelector(".shine-border")).not.toBeNull();
    fireEvent.blur(plainButton);
    expect(plainButton.querySelector(".shine-border")).toBeNull();
  });

  it("resets pagination on reopen and rejects clicks during the closing fade", async () => {
    const many = Array.from({ length: 40 }, (_, uid) => ({ ...alpha, uid }));
    const collections = [{ id: "deck" as const, cards: many }];
    const onClose = vi.fn();
    const view = render(<CardInspectionOverlay {...props} collections={collections} onClose={onClose} />);
    await waitForArtwork();
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
