import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MysteryEffectBadge,
  MysteryEffectList,
} from "@/features/alchemy/run-loop/screens/mystery/mystery-effect-badge";
import { MYSTERY_CARD_CHOICES } from "@/lib/game-constants";
import { keywordDefinitions } from "@/lib/game-data";

describe("MysteryEffectBadge", () => {
  afterEach(() => {
    cleanup();
  });
  it("shows XP amount in tooltip mode", async () => {
    render(
      <MysteryEffectBadge
        effect={{ kind: "gainXP", keyword: "mana", amount: 8 }}
        findCard={undefined}
        findTrinket={undefined}
        tooltip
      />,
    );
    expect(screen.getByText(/8/)).toBeTruthy();
    const token = screen.getByText("Mana");
    expect(token.className).toContain(keywordDefinitions.mana.colorClass);
    fireEvent.mouseEnter(token.closest("span.relative.inline-flex.items-center") ?? token);
    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();
    });
    expect(document.body.textContent).toContain("Mana is used to play cards");
  });

  it("colors Health with an interactive glossary in heal badges", async () => {
    render(
      <MysteryEffectBadge
        effect={{ kind: "healHealth", amount: 5 }}
        findCard={undefined}
        findTrinket={undefined}
        tooltip
      />,
    );
    const token = screen.getByText("Health");
    expect(token.className).toContain(keywordDefinitions.health.colorClass);
    fireEvent.mouseEnter(token.closest("span.relative.inline-flex.items-center") ?? token);
    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();
    });
    expect(document.body.textContent).toContain("Health keeps you alive");
  });

  it("colors the keyword tag with an interactive glossary in chooseCard tooltip text", async () => {
    const { container } = render(
      <MysteryEffectBadge
        effect={{ kind: "chooseCard", tag: "archery" }}
        findCard={undefined}
        findTrinket={undefined}
        tooltip
      />,
    );
    expect(container.textContent).toContain(`Choose 1 of ${MYSTERY_CARD_CHOICES} Archery cards to add to your deck`);
    const token = screen.getByText("Archery");
    expect(token.className).toContain(keywordDefinitions.archery.colorClass);
    fireEvent.mouseEnter(token.closest("span.relative.inline-flex.items-center") ?? token);
    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();
    });
    expect(document.body.textContent).toContain("ranged attacks");
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
