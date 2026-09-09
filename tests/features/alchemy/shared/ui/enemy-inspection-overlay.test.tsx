import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { enemyById, keywordDefinitions } from "@/lib/game-data";
import { getKeywordTextShineColors } from "@/lib/keyword-text-shine";
import { extractKeywordIds } from "@/lib/keyword-text";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { EnemyTraits } from "@/features/alchemy/shared/ui/enemy-traits";
import { EnemyInspectionOverlay } from "@/features/alchemy/shared/ui/enemy-inspection-overlay";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { installDisabledAnimationsForTests } from "../../../../helpers/animation-test";

installDisabledAnimationsForTests();
afterEach(() => {
  cleanup();
  resetEscapeStackForTests();
});

describe("enemy inspection presentation", () => {
  it("names each trait, uses its icon and keyword shine, and formats description keywords", () => {
    const entry = enemyById.vampire;
    const { container } = render(<EnemyTraits entry={entry} />);
    const trait = container.querySelector('[data-enemy-trait="vampire"]')!;
    expect(trait.querySelector("svg.lucide-droplets")).not.toBeNull();
    const title = within(trait as HTMLElement).getByText("Blood Scent");
    expect(title.classList.contains("boss-title-shine")).toBe(true);
    const colors = getKeywordTextShineColors(extractKeywordIds(entry.traits[0].description));
    expect(colors).toHaveLength(6);
    expect(title.getAttribute("style")).toContain("background-image");
    const bleed = Array.from(trait.querySelectorAll("span.font-semibold")).find((span) => span.textContent === "Bleed");
    expect(bleed?.className).toContain(keywordDefinitions.bleed.colorClass);
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("renders encounter modifiers once with the same formatting and keeps neutral traits readable", () => {
    const entry = {
      ...enemyById.bandit,
      traits: [
        ...enemyById.bandit.traits,
        ENCOUNTER_TRAITS.tempered.enemyTrait,
        { id: "constructor", title: "Watchful", description: "Never looks away." },
      ],
    };
    const { container } = render(<EnemyTraits entry={entry} modifiers={["tempered", "tempered"]} />);
    expect(container.querySelectorAll('[data-enemy-trait="tempered"]')).toHaveLength(1);
    expect(screen.getByText("Special Modifiers")).toBeTruthy();
    expect(screen.getByText("Watchful").classList.contains("boss-title-shine")).toBe(false);
    expect(container.querySelector('[data-enemy-trait="tempered"] svg')).not.toBeNull();
  });

  it("uses portrait-only cards and standard tooltips without playing or flipping them", async () => {
    const onClose = vi.fn();
    render(<EnemyInspectionOverlay open entry={enemyById.inquisitor} onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Inquisitor" });
    expect(within(dialog).getByRole("heading", { name: "Traits" })).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Abilities" })).toBeTruthy();
    expect(
      within(dialog)
        .getAllByRole("img")
        .map((image) => image.getAttribute("alt")),
    ).toEqual(["Sunder", "Judgment", "Smite"]);
    expect(dialog.textContent).not.toContain("Deal 4 Physical damage");
    expect(dialog.querySelector("hr, .border-t")).toBeNull();
    const ability = within(dialog).getByRole("button", { name: "Sunder" });
    fireEvent.mouseEnter(ability.parentElement!);
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain(
        "Deal 4 Physical damage",
      ),
    );
    expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain("Remove 2 enemy Armor");
    fireEvent.click(ability);
    expect(within(ability).getByRole("img").getAttribute("alt")).toBe("Sunder");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close enemy inspection" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
