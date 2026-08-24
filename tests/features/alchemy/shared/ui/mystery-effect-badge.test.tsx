// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MysteryEffectBadge, MysteryEffectList } from "@/features/alchemy/shared/ui/mystery-effect-badge";
import { MYSTERY_CARD_CHOICES } from "@/lib/game-constants";

describe("MysteryEffectBadge", () => {
  it("shows XP amount in tooltip mode", () => {
    render(
      <MysteryEffectBadge
        effect={{ kind: "gainXP", keyword: "mana", amount: 8 }}
        findCard={undefined}
        findTrinket={undefined}
        tooltip
      />,
    );
    expect(screen.getByText(/8/)).toBeTruthy();
    expect(screen.getByText(/Mana/)).toBeTruthy();
  });

  it("references MYSTERY_CARD_CHOICES for chooseCard tooltip text", () => {
    render(<MysteryEffectBadge effect={{ kind: "chooseCard" }} findCard={undefined} findTrinket={undefined} tooltip />);
    expect(screen.getByText(new RegExp(`Choose 1 of ${MYSTERY_CARD_CHOICES} cards`))).toBeTruthy();
  });

  it("includes keyword tag in chooseCard tooltip text", () => {
    render(
      <MysteryEffectBadge
        effect={{ kind: "chooseCard", tag: "archery" }}
        findCard={undefined}
        findTrinket={undefined}
        tooltip
      />,
    );
    expect(screen.getByText(new RegExp(`Choose 1 of ${MYSTERY_CARD_CHOICES} Archery cards`))).toBeTruthy();
  });

  it("describes generated gear as an Armory grant", () => {
    render(
      <MysteryEffectBadge
        effect={{ kind: "gainGeneratedGear", baseItemId: "emerald-ring" }}
        findCard={undefined}
        findTrinket={undefined}
        tooltip
      />,
    );
    expect(screen.getByText(/Emerald Ring/)).toBeTruthy();
    expect(screen.getByText(/Armory/)).toBeTruthy();
  });
});

describe("MysteryEffectList", () => {
  it("renders each effect once without a separate description paragraph", () => {
    render(
      <MysteryEffectList
        choiceLabel="Harvest"
        findCard={(id) => (id === "mana-berries" ? { title: "Mana Berries" } : undefined)}
        findTrinket={undefined}
        effects={[
          { kind: "addCard", cardId: "mana-berries" },
          { kind: "gainMaterial", material: "herbs", amount: 2 },
        ]}
      />,
    );

    expect(screen.getByText("Harvest")).toBeTruthy();
    expect(screen.getByText("Harvest").classList.contains("text-sm")).toBe(true);
    expect(screen.getByText("Harvest").classList.contains("font-bold")).toBe(true);
    expect(screen.getByText(/Add Mana Berries card to your deck/).classList.contains("text-sm")).toBe(true);
    expect(screen.getByText(/2 Herbs/).classList.contains("text-sm")).toBe(true);
    expect(screen.queryByText("Add Mana Berries to your deck")).toBeNull();
  });
});
