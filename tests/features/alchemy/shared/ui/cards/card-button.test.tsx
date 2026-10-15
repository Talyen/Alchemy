import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BattleCardButton } from "@/features/alchemy/shared/ui/cards/card-button";
import { SelectableCard } from "@/features/alchemy/shared/ui/cards/selectable-card";
import { cardById, type BattleCard } from "@/lib/game-data/index";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { getCardKeywordShineColors } from "@/features/alchemy/shared/config/shine-palettes";
import { CardTitle } from "@/features/alchemy/shared/ui/cards/card-description-ui";

const card: BattleCard = {
  id: "test-card",
  title: "Test Card",
  descriptionLines: ["Test description."],
  art: "test-card.png",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 1 }],
};

describe("BattleCardButton", () => {
  afterEach(cleanup);

  it("limits title shine to the Transmuted or Corrupted prefix", () => {
    const { container, rerender } = render(<CardTitle card={{ title: "Burning Slash", transmuted: "burn" }} />);
    expect(container.textContent).toBe("Burning Slash");
    expect(container.querySelector(".boss-title-shine")?.textContent).toBe("Burning");
    expect(container.firstElementChild?.classList.contains("text-transparent")).toBe(false);

    rerender(<CardTitle card={{ title: "Slash", corrupted: true }} />);
    expect(container.textContent).toBe("Corrupted Slash");
    expect(container.querySelector(".text-shine-corruption")?.textContent?.trim()).toBe("Corrupted");
    expect(container.firstElementChild?.classList.contains("text-transparent")).toBe(false);

    rerender(<CardTitle card={{ title: "Slash" }} />);
    expect(container.textContent).toBe("Slash");
    expect(container.querySelector(".boss-title-shine, .text-shine-corruption")).toBeNull();
  });

  it.each<BattleCard>([card, { ...card, transmuted: "burn" }, { ...card, corrupted: true }])(
    "keeps inspection and shine active only while focused or hovered ($transmuted, $corrupted)",
    (battleCard) => {
      render(
        <BattleCardButton
          card={battleCard}
          shineColor={getCardKeywordShineColors(battleCard)}
          ariaLabel="Test Card"
          shimmerActive={false}
          shimmerToken={undefined}
        />,
      );
      const button = screen.getByRole("button", { name: "Test Card" });
      const wrapper = button.parentElement!;
      expect(button.querySelector(".shine-border")).toBeNull();
      fireEvent.mouseEnter(wrapper);
      expect(button.querySelector(".shine-border")).not.toBeNull();
      fireEvent.mouseLeave(wrapper);
      expect(button.querySelector(".shine-border")).toBeNull();
      act(() => button.focus());
      expect(button.querySelector(".shine-border")).not.toBeNull();
      fireEvent.mouseEnter(wrapper);
      fireEvent.mouseLeave(wrapper);
      expect(button.dataset.hovered).toBe("true");
      fireEvent.mouseEnter(wrapper);
      act(() => button.blur());
      expect(button.dataset.hovered).toBe("true");
      expect(button.querySelector(".shine-border")).not.toBeNull();
      fireEvent.mouseLeave(wrapper);
      expect(button.dataset.hovered).toBeUndefined();
      expect(button.querySelector(".shine-border")).toBeNull();
    },
  );

  it.each([
    {
      name: "added effect and Consume",
      before: ["Deal 6 Physical damage"],
      after: ["Deal 6 Physical damage", "Gain 2 Block", "Consume"],
      changed: [1, 2],
    },
    {
      name: "changed value and keyword",
      before: ["Deal 6 Physical damage", "Gain 2 Block", "Consume"],
      after: ["Deal 7 Physical damage", "Gain 2 Armor", "Consume"],
      changed: [0, 1],
    },
    {
      name: "unchanged lines reordered and one removed",
      before: ["Deal 6 Physical damage", "Gain 2 Block", "Consume"],
      after: ["Consume", "Deal 6 Physical damage"],
      changed: [],
    },
    {
      name: "duplicate line added",
      before: ["Gain 2 Block", "Consume"],
      after: ["Consume", "Gain 2 Block", "Gain 2 Block"],
      changed: [2],
    },
  ])("marks only resulting changes for $name and clears them outside the event", ({ before, after, changed }) => {
    const result = { ...card, title: "Changed Card", descriptionLines: after };
    const props = {
      card: result,
      ariaLabel: "Result",
      shimmerActive: false,
      shimmerToken: undefined,
    };
    const { rerender } = render(<BattleCardButton {...props} comparisonCard={{ ...card, descriptionLines: before }} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Result" }).parentElement!);
    const tooltip = screen.getByRole("tooltip");
    const chips = within(tooltip).queryAllByText("NEW");
    expect(chips).toHaveLength(changed.length);
    expect(chips.map((chip) => chip.parentElement?.textContent)).toEqual(changed.map((index) => `${after[index]}NEW`));
    rerender(<BattleCardButton {...props} />);
    expect(within(screen.getByRole("tooltip")).queryByText("NEW")).toBeNull();
  });

  it("compares effective Companion lines using the same description context", () => {
    const source = cardById["wolf-companion"]!;
    render(
      <BattleCardButton
        card={{ ...source, descriptionLines: [...source.descriptionLines, "Consume"], consume: true }}
        comparisonCard={source}
        descriptionContext={{
          companionBondLevels: { wolf: 2 },
          companionDamageModifiers: { damageBonus: 4, damageMultiplier: 1 },
        }}
        ariaLabel="Result"
        shimmerActive={false}
        shimmerToken={undefined}
      />,
    );
    act(() => screen.getByRole("button", { name: "Result" }).focus());
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toContain("Deals 7 Bleed or Physical damage each turn");
    expect(within(tooltip).getByText("NEW").parentElement?.textContent).toBe("ConsumeNEW");
  });

  it("updates the changed affixes when a focused preview switches cards", () => {
    const comparisonCard = { ...card, descriptionLines: ["Deal 6 Physical damage", "Consume"] };
    const props = { ariaLabel: "Preview", shimmerActive: false, shimmerToken: undefined, comparisonCard };
    const { rerender } = render(
      <BattleCardButton {...props} card={{ ...card, descriptionLines: ["Deal 6 Burn damage", "Consume"] }} />,
    );
    act(() => screen.getByRole("button", { name: "Preview" }).focus());
    expect(within(screen.getByRole("tooltip")).getByText("NEW").parentElement?.textContent).toBe(
      "Deal 6 Burn damageNEW",
    );
    rerender(
      <BattleCardButton
        {...props}
        card={{ ...card, descriptionLines: ["Deal 6 Physical damage", "Wish", "Consume"] }}
      />,
    );
    expect(within(screen.getByRole("tooltip")).getByText("NEW").parentElement?.textContent).toBe("WishNEW");
  });

  it("keeps unavailable card choices inspectable by keyboard without selecting them", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<SelectableCard card={card} isSelected={false} disabled onSelect={onSelect} />);
    const button = screen.getByRole("button", { name: "Select Test Card" });
    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("tooltip").textContent).toContain("Test description.");
    fireEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
    rerender(<SelectableCard card={card} isSelected={false} onSelect={onSelect} />);
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it.each(["choice", "shop", "deck", "corruption"] as const)("exposes selection changes for %s cards", (chrome) => {
    const { rerender } = render(<SelectableCard card={card} chrome={chrome} isSelected={false} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Select Test Card", pressed: false })).toBeTruthy();
    rerender(<SelectableCard card={card} chrome={chrome} isSelected onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Select Test Card", pressed: true })).toBeTruthy();
    rerender(<SelectableCard card={card} chrome={chrome} isSelected={false} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: "Select Test Card", pressed: false })).toBeTruthy();
  });

  it("renders distilled potion values with green highlighting in popup", () => {
    const distilledHealthPotion = strengthenPotion(cardById["health-potion"]!)!;
    render(
      <BattleCardButton
        card={distilledHealthPotion}
        comparisonCard={cardById["health-potion"]!}
        ariaLabel="Health Potion"
        shimmerActive={false}
        shimmerToken={undefined}
      />,
    );
    const button = screen.getByRole("button", { name: "Health Potion" });
    act(() => button.focus());
    const tooltip = screen.getByRole("tooltip");
    const greenSpan = tooltip.querySelector(".text-green-400");
    expect(greenSpan).not.toBeNull();
    expect(within(tooltip).getByText("NEW").parentElement).toBe(greenSpan?.parentElement);
  });
});
