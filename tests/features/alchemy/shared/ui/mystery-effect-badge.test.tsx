// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MysteryEffectBadge, MysteryEffectList } from "@/features/alchemy/shared/ui/mystery-effect-badge";
import { MYSTERY_CARD_CHOICES } from "@/lib/game-constants";

describe("MysteryEffectBadge", () => {
  afterEach(() => {
    cleanup();
  });
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

  it("describes generated gear as bold shine text with keyword gradient", () => {
    const { container } = render(
      <MysteryEffectBadge
        effect={{ kind: "gainGeneratedGear", baseItemId: "emerald-ring" }}
        findCard={undefined}
        findTrinket={undefined}
        tooltip
      />,
    );
    const title = screen.getByText("Emerald Ring");
    expect(title).toBeTruthy();
    expect(title.classList.contains("font-bold")).toBe(true);
    expect(title.classList.contains("boss-title-shine")).toBe(true);
    expect(title.classList.contains("bg-clip-text")).toBe(true);
    expect(title.style.backgroundImage).toContain("linear-gradient");
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText(/Armory/)).toBeTruthy();
  });

  it("renders astral gear with astral prefix and keyword gradient", () => {
    render(
      <MysteryEffectBadge
        effect={{ kind: "gainGeneratedGear", baseItemId: "sapphire-amulet", astral: true }}
        findCard={undefined}
        findTrinket={undefined}
        tooltip
      />,
    );
    const title = screen.getByText("Astral Sapphire Amulet");
    expect(title).toBeTruthy();
    expect(title.classList.contains("font-bold")).toBe(true);
    expect(title.classList.contains("boss-title-shine")).toBe(true);
    expect(title.style.backgroundImage).toContain("linear-gradient");
  });

  it("renders unique gear with unique definition name and keyword gradient", () => {
    render(
      <MysteryEffectBadge
        effect={{ kind: "gainGeneratedGear", baseItemId: "wardbreaker" }}
        findCard={undefined}
        findTrinket={undefined}
        tooltip
      />,
    );
    const title = screen.getByText("Wardbreaker");
    expect(title).toBeTruthy();
    expect(title.classList.contains("font-bold")).toBe(true);
    expect(title.classList.contains("boss-title-shine")).toBe(true);
    expect(title.style.backgroundImage).toContain("linear-gradient");
  });

  it("renders trinkets as bold shine text with keyword gradient", () => {
    const { container } = render(
      <MysteryEffectBadge
        effect={{ kind: "gainTrinket", trinketId: "icy-heart" }}
        findCard={undefined}
        findTrinket={() => ({ title: "Icy Heart" })}
        tooltip
      />,
    );
    const title = screen.getByText("Icy Heart");
    expect(title).toBeTruthy();
    expect(title.classList.contains("font-bold")).toBe(true);
    expect(title.classList.contains("boss-title-shine")).toBe(true);
    expect(title.style.backgroundImage).toContain("linear-gradient");
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText(/Gain/)).toBeTruthy();
    expect(screen.getByText("Boon • This Run")).toBeTruthy();
    expect(screen.queryByText(/for this run/)).toBeNull();
  });

  it("renders random boon as bold shine text", () => {
    render(
      <MysteryEffectBadge
        effect={{ kind: "gainRandomTrinket" }}
        findCard={undefined}
        findTrinket={undefined}
        tooltip
      />,
    );
    const title = screen.getByText("Boon");
    expect(title).toBeTruthy();
    expect(title.classList.contains("font-bold")).toBe(true);
    expect(title.classList.contains("boss-title-shine")).toBe(true);
  });

  it("renders addCard as bold shine text with card keyword gradient", () => {
    const { container } = render(
      <MysteryEffectBadge
        effect={{ kind: "addCard", cardId: "strike" }}
        findCard={() => ({
          id: "strike",
          title: "Strike",
          energyCost: 1,
          rarity: "common",
          character: "knight",
          targetType: "single-enemy",
          descriptionLines: ["Deal 6 physical damage"],
          effects: [{ kind: "damage", amount: 6, damageType: "physical" }],
        })}
        findTrinket={undefined}
        tooltip
      />,
    );
    const title = screen.getByText("Strike");
    expect(title).toBeTruthy();
    expect(title.classList.contains("font-bold")).toBe(true);
    expect(title.classList.contains("boss-title-shine")).toBe(true);
    expect(title.style.backgroundImage).toContain("linear-gradient");
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText(/to your deck/)).toBeTruthy();
    expect(screen.queryByText(/card to your deck/)).toBeNull();
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
    expect(screen.getByText("Mana Berries")).toBeTruthy();
    expect(screen.getByText(/to your deck/).classList.contains("text-sm")).toBe(true);
    expect(screen.getByText(/2 Herbs/).parentElement?.classList.contains("text-xs")).toBe(true);
    expect(screen.queryByText("Add Mana Berries to your deck")).toBeNull();
  });
});
