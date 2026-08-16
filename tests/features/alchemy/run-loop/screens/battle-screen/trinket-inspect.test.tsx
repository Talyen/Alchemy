// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetEscapeStackForTests } from "@/app/escape-stack";
import { BattleTrinketInspectOverlay } from "@/features/alchemy/run-loop/screens/battle-screen/trinket-inspect";
import { uniqueRunTrinkets } from "@/features/alchemy/run-loop/screens/battle-screen/unique-run-trinkets";
import { TRINKET_PAGE_SIZE } from "@/lib/game-constants";
import { trinketLibrary, type TrinketEntry } from "@/lib/game-data";

const library: TrinketEntry[] = [
  { id: "alpha", title: "Alpha Charm", descriptionLines: ["Gain 1 Block."], art: "alpha-art" },
  { id: "beta", title: "Beta Stone", descriptionLines: ["Draw 1."], art: "beta-art" },
];

describe("uniqueRunTrinkets", () => {
  it("keeps first-seen ids and skips duplicates and unknown entries", () => {
    expect(uniqueRunTrinkets(["beta", "missing", "alpha", "beta", "alpha"], library).map((entry) => entry.id)).toEqual([
      "beta",
      "alpha",
    ]);
  });

  it("returns an empty list when nothing resolves", () => {
    expect(uniqueRunTrinkets(["missing"], library)).toEqual([]);
  });
});

describe("BattleTrinketInspectOverlay", () => {
  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
  });

  it("lists unique trinket art and shows a This Run tooltip on hover", () => {
    render(
      <BattleTrinketInspectOverlay open trinketIds={["brass-censer", "brass-censer", "meteorite"]} onClose={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { name: "Trinkets" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Brass Censer" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Meteorite" })).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(2);

    const img = screen.getByRole("img", { name: "Brass Censer" });
    const tileWrapper = img.parentElement?.parentElement;
    expect(tileWrapper).toBeTruthy();
    fireEvent.mouseEnter(tileWrapper!);

    expect(screen.getByText("Brass Censer")).toBeTruthy();
    expect(screen.getByText("This Run")).toBeTruthy();
    expect(screen.getByText(/Holy/)).toBeTruthy();
  });

  it("closes on Escape and on backdrop click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BattleTrinketInspectOverlay open trinketIds={["brass-censer"]} onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("battle-trinket-inspect-overlay"));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("img", { name: "Brass Censer" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes from the header close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<BattleTrinketInspectOverlay open trinketIds={["brass-censer"]} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: "Close trinkets" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("pages when there are more trinkets than one inspect page", async () => {
    const user = userEvent.setup();
    const ids = trinketLibrary.slice(0, TRINKET_PAGE_SIZE + 1).map((entry) => entry.id);
    render(<BattleTrinketInspectOverlay open trinketIds={ids} onClose={vi.fn()} />);

    expect(screen.getAllByRole("img")).toHaveLength(TRINKET_PAGE_SIZE);
    expect(screen.getByRole("img", { name: trinketLibrary[0]!.title })).toBeTruthy();
    expect(screen.queryByRole("img", { name: trinketLibrary[TRINKET_PAGE_SIZE]!.title })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByRole("img", { name: trinketLibrary[TRINKET_PAGE_SIZE]!.title })).toBeTruthy();
    expect(screen.queryByRole("img", { name: trinketLibrary[0]!.title })).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
});
