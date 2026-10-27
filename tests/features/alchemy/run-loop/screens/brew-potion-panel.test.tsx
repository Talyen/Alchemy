import { installFocusInputForTests } from "../../../../helpers/focus-input-test";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrewPotionPanel } from "@/features/alchemy/run-loop/screens/brew-potion-panel";
import { cardById, type BattleCard } from "@/lib/game-data";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { tryCreateMixedPotion } from "@/lib/alchemist";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../helpers/artwork-test";
import { resetEscapeStackForTests } from "@/app/escape-stack";

installFocusInputForTests(true);
installReadyArtworkForTests();
vi.mock("@/features/alchemy/shared/ui/cards/selectable-card", () => ({
  SelectableCard: ({ card, onSelect }: { card: BattleCard; onSelect: () => void }) => (
    <button onClick={onSelect}>Select {card.title}</button>
  ),
}));
vi.mock(
  "@/features/alchemy/shared/ui/cards/card-selection-grid",
  () => import("../../../../helpers/shop-screen-ui-mocks"),
);
afterEach(() => {
  cleanup();
  resetEscapeStackForTests();
  vi.restoreAllMocks();
});
function pickMixPotion(title: string, slot: number) {
  fireEvent.click(screen.getByRole("button", { name: `Choose Potion for slot ${slot}` }));
  fireEvent.click(screen.getAllByRole("button", { name: `Select ${title}` })[0]!);
}
describe("Brew selection safety", () => {
  installDisabledAnimationsForTests();
  it.each(["keyboard", "pointer"])("confirms a single Potion through the Strengthen flow (%s)", (input) => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    HTMLElement.prototype.scrollIntoView = vi.fn();
    const onConfirm = vi.fn(() => null);
    render(
      <BrewPotionPanel
        deck={[cardById["health-potion"]!, cardById["mana-potion"]!, cardById["wishing-potion"]!]}
        kind="strengthen"
        onConfirm={onConfirm}
        onBack={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Mix" })).toBeNull();
    expect(screen.getByRole("button", { name: "Select Wishing Potion" })).toBeTruthy();
    const choice = screen.getByRole("button", { name: "Select Health Potion" });
    choice.focus();
    if (input === "pointer") fireEvent.pointerDown(choice);
    fireEvent.click(choice);
    expect(screen.getByRole("button", { name: "Inspect brew result: Health Potion" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Original: Health Potion" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Select Health Potion" })).toBeNull();
    expect(document.activeElement).toBe(
      input === "keyboard" ? screen.getByRole("button", { name: "Distill" }) : document.body,
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("button", { name: "Inspect brew result: Health Potion" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Select Mana Potion" }));
    fireEvent.click(screen.getByRole("button", { name: "Distill" }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({ kind: "strengthen", index: 1 });
  });
  it("requires fresh source selection if the deck changes before confirmation", () => {
    const deck = [cardById["health-potion"]!, cardById["mana-potion"]!];
    const onConfirm = vi.fn(() => null);
    const onBack = vi.fn();
    const { rerender } = render(<BrewPotionPanel kind="combine" deck={deck} onConfirm={onConfirm} onBack={onBack} />);
    pickMixPotion("Health Potion", 1);
    pickMixPotion("Mana Potion", 2);
    expect((screen.getByRole("button", { name: "Mix" }) as HTMLButtonElement).disabled).toBe(false);
    rerender(<BrewPotionPanel kind="combine" deck={[deck[1]!, deck[0]!]} onConfirm={onConfirm} onBack={onBack} />);
    expect(screen.queryByRole("button", { name: "Inspect brew result: Mixed Potion" })).toBeNull();
    expect((screen.getByRole("button", { name: "Mix" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("Deck changed");
    fireEvent.click(screen.getByRole("button", { name: "Mix" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("disables the confirmation button when a progress save is pending", () => {
    const deck = [cardById["health-potion"]!, cardById["mana-potion"]!];
    const onConfirm = vi.fn(() => null);
    render(
      <BrewPotionPanel
        kind="combine"
        deck={deck}
        onConfirm={onConfirm}
        onBack={() => {}}
        isProgressSavePending={() => true}
      />,
    );
    expect((screen.getByRole("button", { name: "Choose Potion for slot 1" }) as HTMLButtonElement).disabled).toBe(true);
    const button = screen.getByRole("button", { name: "Mix" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it.each(["strengthen", "combine"] as const)("retains its accepted %s preview while saving", (kind) => {
    const deck = [cardById["health-potion"]!, cardById["mana-potion"]!];
    const brewed = kind === "strengthen" ? strengthenPotion(deck[0]!)! : tryCreateMixedPotion(deck[0], deck[1])!;
    const onConfirm = vi.fn(() => brewed);
    const p = { kind, deck, onConfirm, onBack: () => {}, price: 10, gold: 10 };
    const { rerender } = render(<BrewPotionPanel {...p} />);
    if (kind === "combine") {
      pickMixPotion("Health Potion", 1);
      pickMixPotion("Mana Potion", 2);
    } else fireEvent.click(screen.getByRole("button", { name: "Select Health Potion" }));
    const action = kind === "strengthen" ? "Distill" : "Mix";
    fireEvent.click(screen.getByRole("button", { name: action }));
    rerender(<BrewPotionPanel {...p} deck={[brewed]} gold={0} isProgressSavePending={() => true} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Not enough Gold/)).toBeNull();
    expect(screen.getByRole("button", { name: `Inspect brew result: ${brewed.title}` })).toBeTruthy();
    if (kind === "strengthen") {
      expect(screen.getByRole("button", { name: "Original: Health Potion" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Select Health Potion" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Choose Another Potion" })).toBeNull();
    }
    if (kind === "combine") {
      expect(screen.queryByRole("button", { name: "Mix" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Change Potion in slot 1" })).toBeNull();
      expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    } else expect((screen.getByRole("button", { name: action }) as HTMLButtonElement).disabled).toBe(true);
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(
      kind === "strengthen" ? { kind, index: 0 } : { kind, indices: [0, 1] },
    );
  });
  it("replaces either ingredient through its card without losing a cancelled recipe or mixing twice", () => {
    const deck = [cardById["health-potion"]!, cardById["mana-potion"]!, cardById["stoneskin-potion"]!];
    const brewed = tryCreateMixedPotion(deck[1], deck[2])!;
    const onConfirm = vi.fn(() => brewed),
      onBack = vi.fn(),
      onContinue = vi.fn();
    const props = { kind: "combine" as const, deck, onConfirm, onBack, price: 40, gold: 40 };
    const { rerender } = render(<BrewPotionPanel {...props} />);
    expect(screen.queryByRole("button", { name: "Select Health Potion" })).toBeNull();
    pickMixPotion("Health Potion", 1);
    fireEvent.click(screen.getByRole("button", { name: "Choose Potion for slot 2" }));
    expect(screen.queryByRole("button", { name: "Select Health Potion" })).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Change Potion in slot 1" })).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
    pickMixPotion("Mana Potion", 2);
    fireEvent.click(screen.getByRole("button", { name: "Change Potion in slot 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Stoneskin Potion" }));
    expect(screen.queryByRole("button", { name: /Remove Potion from slot/ })).toBeNull();
    const firstSlot = screen.getByRole("button", { name: "Change Potion in slot 1" });
    expect(firstSlot.querySelector("img")?.alt).toBe("Health Potion");
    expect(screen.getByRole("button", { name: "Change Potion in slot 2" }).querySelector("img")?.alt).toBe(
      "Stoneskin Potion",
    );
    firstSlot.focus();
    fireEvent.click(firstSlot, { detail: 0 });
    expect(screen.queryByRole("button", { name: "Select Stoneskin Potion" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Change Potion in slot 1" }).querySelector("img")?.alt).toBe(
      "Health Potion",
    );
    expect(screen.getByRole("button", { name: "Inspect brew result: Mixed Potion" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change Potion in slot 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Mana Potion" }));
    const mix = screen.getByRole("button", { name: "Mix" });
    fireEvent.click(mix);
    fireEvent.click(mix);
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({ kind: "combine", indices: [1, 2] });
    expect(screen.getByRole("button", { name: "Inspect brew result: Mixed Potion" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change Potion in slot 2" })).toBeNull();
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<BrewPotionPanel {...props} deck={[brewed]} gold={0} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
  it("allows separate copies of the same Potion but cannot spend insufficient Gold", () => {
    const potion = cardById["health-potion"]!,
      onConfirm = vi.fn(() => null);
    render(
      <BrewPotionPanel
        kind="combine"
        deck={[potion, potion]}
        price={40}
        gold={39}
        onConfirm={onConfirm}
        onBack={() => {}}
      />,
    );
    pickMixPotion("Health Potion", 1);
    pickMixPotion("Health Potion", 2);
    expect(screen.getByRole("button", { name: "Inspect brew result: Mixed Potion" })).toBeTruthy();
    const mix = screen.getByRole("button", { name: "Mix" }) as HTMLButtonElement;
    expect(mix.disabled).toBe(true);
    fireEvent.click(mix);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("moves one mounted card, drops distinct ingredients, and cancels without selecting", () => {
    const onConfirm = vi.fn(() => null);
    const { container } = render(
      <BrewPotionPanel
        kind="combine"
        deck={[cardById["health-potion"]!, cardById["mana-potion"]!, cardById["stoneskin-potion"]!]}
        onConfirm={onConfirm}
        onBack={() => {}}
      />,
    );
    container.querySelectorAll<HTMLElement>("[data-preparation-slot]").forEach((target, slot) => {
      vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
        left: 100 + slot * 200,
        top: 100,
        right: 200 + slot * 200,
        bottom: 220,
      } as DOMRect);
    });
    const drag = (title: string, slot: number, cancel: boolean | "outside" = false) => {
      const source = screen.getAllByRole("button", { name: `Select ${title}` })[0]!;
      const movable = source.closest<HTMLElement>("[data-potion-movable]")!;
      fireEvent.pointerDown(source, { pointerId: 1, button: 0, isPrimary: true, clientX: 20, clientY: 20 });
      fireEvent.pointerMove(source, { pointerId: 1, clientX: 150 + slot * 200, clientY: 150 });
      expect(movable.style.transform).toContain("translate(");
      expect(
        [...container.querySelectorAll<HTMLElement>("[data-potion-movable]")].filter((card) => card.style.transform),
      ).toHaveLength(1);
      if (cancel === true) fireEvent.pointerCancel(source, { pointerId: 1 });
      else
        fireEvent.pointerUp(source, {
          pointerId: 1,
          clientX: cancel === "outside" ? 20 : 150 + slot * 200,
          clientY: cancel === "outside" ? 20 : 150,
        });
      expect(movable.style.transform).toBe("");
      fireEvent.click(source, { detail: 1 });
    };
    fireEvent.click(screen.getByRole("button", { name: "Choose Potion for slot 1" }));
    drag("Stoneskin Potion", 0, true);
    drag("Stoneskin Potion", 0, "outside");
    expect(screen.queryByRole("button", { name: "Change Potion in slot 1" })).toBeNull();
    drag("Health Potion", 1);
    expect((screen.getByRole("button", { name: "Mix" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Choose Potion for slot 1" }));
    drag("Mana Potion", 0);
    fireEvent.click(screen.getByRole("button", { name: "Change Potion in slot 2" }));
    drag("Health Potion", 0);
    fireEvent.click(screen.getByRole("button", { name: "Mix" }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({ kind: "combine", indices: [0, 1] });
  });
  it("keeps Distill choices above a persistent input slot and preview", () => {
    const kind = "strengthen" as const;
    const onConfirm = vi.fn(() => null),
      onBack = vi.fn();
    const cards = [cardById["health-potion"]!, cardById["mana-potion"]!];
    render(
      <BrewPotionPanel
        kind={kind}
        variant="alchemist"
        deck={cards}
        offers={cards}
        onConfirm={onConfirm}
        onBack={onBack}
      />,
    );
    expect(screen.getByRole("img", { name: "Empty Potion slot 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select Health Potion" }));
    expect(screen.getByRole("button", { name: "Remove Potion from slot 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select Mana Potion" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inspect brew result: Health Potion" })).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("img", { name: "Empty Potion slot 1" })).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Select Mana Potion" }));
    fireEvent.click(screen.getByRole("button", { name: "Distill" }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({ kind, index: 1 });
  });
  it("chooses Brew through the slot, reopens choices, and cancels without replacing or purchasing", async () => {
    const onConfirm = vi.fn(() => null),
      onBack = vi.fn();
    const cards = [cardById["health-potion"]!, cardById["mana-potion"]!];
    render(
      <BrewPotionPanel
        kind="new"
        variant="alchemist"
        deck={cards}
        offers={cards}
        price={40}
        gold={100}
        onConfirm={onConfirm}
        onBack={onBack}
      />,
    );
    const slot = () => screen.getByRole("button", { name: "Choose a Potion" });
    expect(screen.queryByRole("button", { name: "Choose Health Potion" })).toBeNull();
    const choose = async (title: string) => {
      fireEvent.click(slot());
      await waitForArtwork();
      fireEvent.click(
        within(screen.getByRole("dialog", { name: "Choose a Potion" })).getByRole("button", {
          name: `Choose ${title}`,
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    };
    await choose("Health Potion");
    expect(slot().querySelector("img")?.alt).toBe("Health Potion");
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(slot());
    await waitForArtwork();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(slot().querySelector("img")?.alt).toBe("Health Potion");
    expect(onBack).not.toHaveBeenCalled();
    await choose("Mana Potion");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(slot().querySelector("img")?.alt).toBe("Mana Potion");
    expect(onConfirm).not.toHaveBeenCalled();
    const buy = screen.getByRole("button", { name: "Brew" });
    const cost = document.getElementById(buy.getAttribute("aria-describedby")!)!;
    expect(buy.textContent).toBe("Brew");
    expect(cost.querySelector('img[alt="Gold"]')).toBeTruthy();
    expect(cost.closest("button")).toBeNull();
    expect(cost.textContent).toContain("40");
    fireEvent.click(buy);
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({ kind: "new", offerIndex: 1 });
  });
});
