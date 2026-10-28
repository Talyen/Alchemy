import { makeTestCard } from "../../../../fixtures/cards";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CorruptionScreen } from "@/features/alchemy/run-loop/screens/corruption-screen";
import type { BattleCard } from "@/lib/game-data";
import type { CorruptionResult } from "@/lib/corruption";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

const testSlash: BattleCard = makeTestCard({
  id: "slash",
  title: "Slash",
  descriptionLines: ["Deal 6 Physical damage"],
  art: "slash",
  effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
});

const testStab: BattleCard = makeTestCard({
  id: "stab",
  title: "Stab",
  descriptionLines: ["Deal 4 Physical damage"],
  art: "stab",
  effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
});

const testCorruptedCard: BattleCard = {
  ...testSlash,
  descriptionLines: ["Deal 7 Physical damage"],
  effects: [{ kind: "damage", damageType: "physical", amount: 7 }],
  corrupted: true,
};

describe("CorruptionScreen", () => {
  installDisabledAnimationsForTests();

  beforeEach(() => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(100);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("requires a new selection when the deck changes instead of corrupting a different card", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    const onCorrupt = vi.fn();
    const { rerender } = render(
      <CorruptionScreen runDeck={[testSlash, testStab]} result={null} onCorrupt={onCorrupt} onExit={onExit} />,
    );
    await user.click(await screen.findByRole("button", { name: "Corrupt a Card" }));
    await user.click(await screen.findByRole("button", { name: "Select Slash" }));
    rerender(<CorruptionScreen runDeck={[testStab]} result={null} onCorrupt={onCorrupt} onExit={onExit} />);
    const confirm = await screen.findByRole("button", { name: "Corrupt" });
    expect(confirm).toHaveProperty("disabled", true);
    expect(screen.getByRole("status").textContent).toContain("Your deck changed");
    await user.click(confirm);
    expect(onCorrupt).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Select Stab" }));
    await user.click(confirm);
    expect(onCorrupt).toHaveBeenCalledWith(0);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("navigates from intro to deck picker and allows corrupting a selected card", async () => {
    const user = userEvent.setup();
    const onCorrupt = vi.fn();
    render(<CorruptionScreen runDeck={[testSlash, testStab]} result={null} onCorrupt={onCorrupt} onExit={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /Corrupt a Card/i }));

    expect(await screen.findByText("The altar may weaken, strengthen, or remake your card.")).toBeTruthy();
    await screen.findByRole("button", { name: /Select Slash/i });

    const corruptConfirmBtn = screen.getByRole("button", { name: "Corrupt" });
    expect(corruptConfirmBtn).toHaveProperty("disabled", true);

    const cardButton = screen.getByRole("button", { name: /Select Slash/i });
    await user.click(cardButton);

    expect(corruptConfirmBtn).toHaveProperty("disabled", false);
    await user.click(corruptConfirmBtn);

    expect(onCorrupt).toHaveBeenCalledWith(0);
  });

  it.each([testCorruptedCard, { ...testSlash, transmuted: "burn" as const, title: "Burning Slash" }])(
    "disables corruption when no eligible cards remain",
    async (card) => {
      render(<CorruptionScreen runDeck={[card]} result={null} onCorrupt={vi.fn()} onExit={vi.fn()} />);

      expect(await screen.findByRole("button", { name: /Corrupt a Card/i })).toHaveProperty("disabled", true);
      expect(screen.getByRole("button", { name: "Leave" })).toHaveProperty("disabled", false);
      expect(screen.getByText("No eligible cards remain.")).toBeTruthy();
    },
  );

  it("renders result comparison view when a corruption result is present", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(100);
    const result: CorruptionResult = {
      originalCard: testSlash,
      corruptedCard: testCorruptedCard,
      transformed: false,
      delta: 1,
    };

    render(<CorruptionScreen runDeck={[testCorruptedCard]} result={result} onCorrupt={vi.fn()} onExit={onExit} />);

    expect(screen.getByText("The altar returns your card changed.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Original: Slash/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Result: Corrupted Slash/i })).toBeTruthy();

    const resultButton = screen.getByRole("button", { name: /Result: Corrupted Slash/i });
    await waitFor(() => expect(resultButton.closest("[inert]")).toBeNull());
    await user.hover(resultButton);
    expect((await screen.findByText("NEW")).parentElement?.textContent).toBe("Deal 7 Physical damageNEW");
    await user.unhover(resultButton);
    await user.hover(screen.getByRole("button", { name: /Original: Slash/i }));
    expect(screen.queryByText("NEW")).toBeNull();

    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("keeps the original comparison visible and retires the picker as soon as corruption commits", async () => {
    localStorage.removeItem("alchemy-disable-animations");
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(100);
    const user = userEvent.setup();
    const onCorrupt = vi.fn();
    const onExit = vi.fn();
    const { rerender } = render(
      <CorruptionScreen runDeck={[testSlash]} result={null} onCorrupt={onCorrupt} onExit={onExit} />,
    );
    await user.click(await screen.findByRole("button", { name: "Corrupt a Card" }));
    await user.click(await screen.findByRole("button", { name: "Select Slash" }));
    const heading = screen.getByRole("heading", { name: "Altar of Corruption" });
    await user.click(screen.getByRole("button", { name: "Corrupt" }));
    const result: CorruptionResult = {
      originalCard: testSlash,
      corruptedCard: testCorruptedCard,
      transformed: false,
      delta: 1,
    };
    rerender(<CorruptionScreen runDeck={[testCorruptedCard]} result={result} onCorrupt={onCorrupt} onExit={onExit} />);

    const original = screen.getByRole("button", { name: "Original: Slash" });
    expect(original.closest(".screen-fade-out, [inert]")).toBeNull();
    expect(screen.getByRole("heading", { name: "Altar of Corruption" })).toBe(heading);
    expect(screen.queryByRole("button", { name: "Corrupt", hidden: true })).toBeNull();
    expect(onCorrupt).toHaveBeenCalledExactlyOnceWith(0);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("retains the illustration until picker artwork is ready and blocks outgoing or decoding controls", async () => {
    localStorage.removeItem("alchemy-disable-animations");
    const user = userEvent.setup();
    const onCorrupt = vi.fn();
    const onExit = vi.fn();
    const { container } = render(
      <CorruptionScreen runDeck={[testSlash, testStab]} result={null} onCorrupt={onCorrupt} onExit={onExit} />,
    );
    const enter = await screen.findByRole("button", { name: "Corrupt a Card" });
    const leave = screen.getByRole("button", { name: "Leave" });
    const heading = screen.getByRole("heading", { name: "Altar of Corruption" });
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(false);
    await user.click(enter);
    const intro = container.querySelector('[data-corruption-entry-panel="intro"]')!;
    const picker = container.querySelector('[data-corruption-entry-panel="picker"]')!;
    expect(intro.getAttribute("style")).toBe("opacity: 1;");
    expect(intro.hasAttribute("inert")).toBe(true);
    expect(picker.hasAttribute("data-artwork-pending")).toBe(true);
    expect(screen.getByRole("heading", { name: "Altar of Corruption" })).toBe(heading);
    fireEvent.click(leave);
    fireEvent.keyDown(leave, { key: "Enter" });
    fireEvent.click(picker.querySelector("button")!);
    expect(onExit).not.toHaveBeenCalled();
    expect(onCorrupt).not.toHaveBeenCalled();
    for (const image of picker.querySelectorAll("img")) fireEvent.load(image);
    await screen.findByRole("button", { name: "Select Slash" });
    expect(picker.hasAttribute("inert")).toBe(false);
    expect(intro.getAttribute("style")).toBe("opacity: 0;");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByRole("button", { name: "Corrupt a Card" });
    expect(onCorrupt).not.toHaveBeenCalled();
  });

  it.each(["button", "Escape"])("resets selection when canceling with %s and re-entering", async (method) => {
    const user = userEvent.setup();
    render(<CorruptionScreen runDeck={[testSlash, testStab]} result={null} onCorrupt={vi.fn()} onExit={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /Corrupt a Card/i }));
    await user.click(await screen.findByRole("button", { name: /Select Stab/i }));

    const corruptConfirmBtn = screen.getByRole("button", { name: "Corrupt" });
    expect(corruptConfirmBtn).toHaveProperty("disabled", false);

    if (method === "Escape") await user.keyboard("{Escape}");
    else await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(await screen.findByRole("button", { name: "Corrupt a Card" })).toBeTruthy();

    // Re-entering picker should have selection cleared
    await user.click(await screen.findByRole("button", { name: /Corrupt a Card/i }));
    const newCorruptBtn = await screen.findByRole("button", { name: "Corrupt" });
    expect(newCorruptBtn).toHaveProperty("disabled", true);
  });
});
