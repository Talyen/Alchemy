import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { RemoveCardPanel } from "@/features/alchemy/shared/ui/remove-card-panel";
import type { BattleCard } from "@/lib/game-data";

vi.mock("@/features/alchemy/shared/ui/cards/selectable-card", () => import("../../../../helpers/shop-screen-ui-mocks"));

const runDeck = [
  {
    id: "card-1",
    title: "Card One",
    descriptionLines: ["A card."],
    art: "card",
    cost: 1,
    effects: [],
  } as BattleCard,
];

describe("RemoveCardPanel", () => {
  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
  });

  it("requires a fresh selection when a changed deck puts a different card in the selected slot", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { rerender } = render(<RemoveCardPanel runDeck={runDeck} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Select shop card" }));
    expect(screen.getByRole("button", { name: "Remove Card" })).toHaveProperty("disabled", false);

    rerender(<RemoveCardPanel runDeck={[{ ...runDeck[0]!, id: "replacement" }]} onConfirm={onConfirm} />);
    const remove = screen.getByRole("button", { name: "Remove Card" });
    expect(remove).toHaveProperty("disabled", true);
    expect(screen.getByRole("status").textContent).toMatch(/deck changed/i);
    await user.click(remove);
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Select shop card" }));
    await user.click(remove);
    expect(onConfirm).toHaveBeenCalledWith(0);
  });

  it("calls onCancel on Escape and stops GameMenu from receiving the key", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const gameMenuHandler = vi.fn();

    window.addEventListener("keydown", gameMenuHandler);
    render(<RemoveCardPanel runDeck={runDeck} intro={<p>Remove a card</p>} onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(gameMenuHandler).not.toHaveBeenCalled();
    expect(screen.getByText("Remove a card")).toBeTruthy();

    window.removeEventListener("keydown", gameMenuHandler);
  });

  it("does not register Escape handling when onCancel is omitted", async () => {
    const user = userEvent.setup();
    const gameMenuHandler = vi.fn();

    window.addEventListener("keydown", gameMenuHandler);
    render(<RemoveCardPanel runDeck={runDeck} intro={<p>Remove a card</p>} onConfirm={vi.fn()} />);

    await user.keyboard("{Escape}");

    expect(gameMenuHandler).toHaveBeenCalled();

    window.removeEventListener("keydown", gameMenuHandler);
  });

  it("does not call onCancel on Escape when escapeCancels is false", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const gameMenuHandler = vi.fn();

    window.addEventListener("keydown", gameMenuHandler);
    render(
      <RemoveCardPanel
        runDeck={runDeck}
        intro={<p>Remove a card</p>}
        onConfirm={vi.fn()}
        onCancel={onCancel}
        escapeCancels={false}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onCancel).not.toHaveBeenCalled();
    expect(gameMenuHandler).toHaveBeenCalled();

    window.removeEventListener("keydown", gameMenuHandler);
  });
});
