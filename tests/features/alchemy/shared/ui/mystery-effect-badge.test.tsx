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

  it("names the generated Astral item", () => {
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
  });

  it("names the temporary Boon reward", () => {
    render(
      <MysteryEffectBadge
        effect={{ kind: "gainTrinket", trinketId: "icy-heart" }}
        findCard={undefined}
        findTrinket={() => ({ title: "Icy Heart" })}
        tooltip
      />,
    );
    const title = screen.getByText("Icy Heart");
    expect(title).toBeTruthy();
    expect(screen.getByText(/Gain/)).toBeTruthy();
    expect(screen.getByText("Boon")).toBeTruthy();
    expect(screen.queryByText(/for this run/)).toBeNull();
  });

  it("describes random gear as an Armory reward", () => {
    render(
      <MysteryEffectBadge effect={{ kind: "gainRandomGear" }} findCard={undefined} findTrinket={undefined} tooltip />,
    );

    expect(screen.getByText("Add random Gear to your Armory")).toBeTruthy();
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
    expect(screen.getByText("Mana Berries")).toBeTruthy();
    expect(screen.getByText(/to your deck/)).toBeTruthy();
    expect(screen.getByText(/2 Herbs/)).toBeTruthy();
    expect(screen.queryByText("Add Mana Berries to your deck")).toBeNull();
  });
});
