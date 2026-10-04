import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MysteryEffectBadge,
  MysteryEffectList,
} from "@/features/alchemy/run-loop/screens/mystery/mystery-effect-badge";
import { MYSTERY_CARD_CHOICES } from "@/lib/game-constants";

afterEach(cleanup);

it("explains the card-choice affinity through the glossary before the player commits", async () => {
  const { container } = render(<MysteryEffectBadge effect={{ kind: "chooseCard", tag: "archery" }} tooltip />);
  expect(container.textContent).toBe(`Choose 1 of ${MYSTERY_CARD_CHOICES} Archery cards to add to your deck`);
  const token = screen.getByText("Archery");
  fireEvent.mouseEnter(token.closest("span.relative.inline-flex.items-center") ?? token);
  await waitFor(() => expect(document.body.textContent).toContain("ranged attacks"));
});

it("keeps reward amounts and destinations visible exactly once in the choice preview", () => {
  const { container } = render(
    <MysteryEffectList
      choiceLabel="Harvest"
      findCard={(id) => (id === "mana-berries" ? { title: "Mana Berries" } : undefined)}
      findTrinket={() => ({ title: "Icy Heart" })}
      effects={[
        { kind: "addCard", cardId: "mana-berries" },
        { kind: "gainMaterial", material: "herbs", amount: 2 },
        { kind: "loseGold", amount: 7 },
        { kind: "gainTrinket", trinketId: "icy-heart" },
        { kind: "gainGeneratedGear", baseItemId: "sapphire-amulet", astral: true },
      ]}
    />,
  );
  expect(screen.getAllByText("Mana Berries")).toHaveLength(1);
  expect(container.textContent).toContain("Add Mana Berries to your deck");
  expect(container.textContent).toContain("Find 2 Herbs");
  expect(container.textContent).toContain("Lose 7 Gold");
  expect(container.textContent).toContain("Gain Icy Heart Boon");
  expect(container.textContent).toContain("Add Astral Sapphire Amulet to your Armory");
});
