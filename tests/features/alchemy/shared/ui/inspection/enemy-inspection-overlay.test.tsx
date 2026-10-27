import { patchBattleState } from "../../../../../fixtures/battle";
import { createRef } from "react";
import { EnemyTooltip } from "@/features/alchemy/shared/ui/tooltips/enemy-tooltip";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enemyById } from "@/lib/game-data";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { EnemyTraits } from "@/features/alchemy/shared/ui/enemy-traits";
import { EnemyInspectionOverlay } from "@/features/alchemy/shared/ui/inspection/enemy-inspection-overlay";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { installDisabledAnimationsForTests } from "../../../../../helpers/animation-test";
import { installReadyArtworkForTests, waitForArtwork } from "../../../../../helpers/artwork-test";

installDisabledAnimationsForTests();
installReadyArtworkForTests();
beforeEach(() => {
  // JSDOM has no layout boxes; dialog focus still requires visible controls.
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    new DOMRect(0, 0, 100, 30),
  ] as unknown as DOMRectList);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetEscapeStackForTests();
});

describe("enemy inspection presentation", () => {
  it("explains native weaknesses and encounter modifiers together", () => {
    const entry = enemyById.vampire;
    const { container } = render(
      <EnemyTraits entry={entry} modifiers={["combustible", "executioner"]} layout="inspection" />,
    );
    const trait = container.querySelector('[data-enemy-trait="vampire"]')!;
    expect(container.querySelectorAll("[data-enemy-trait]")).toHaveLength(4);
    expect(trait.textContent).not.toContain("Receives");
    const curse = container.querySelector('[data-enemy-trait="holy-vulnerability"]')!;
    expect(curse.textContent).toContain("Profane");
    expect(curse.textContent).toContain("Receives 30% more Holy damage");
    expect(screen.getByText("Scorching")).toBeTruthy();
    expect(screen.getByText("Desperation")).toBeTruthy();
  });

  it("deduplicates encounter modifiers without dropping unfamiliar native traits", () => {
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
    expect(screen.getByText("Watchful")).toBeTruthy();
    expect(screen.queryByText("Special Modifiers")).toBeNull();
    expect(
      [...container.querySelectorAll("[data-enemy-trait]")].map((node) => node.getAttribute("data-enemy-trait")),
    ).toEqual(["bandit", "cowardly", "constructor", "tempered"]);
  });

  it("shows scaled native and encounter traits in the portrait tooltip", async () => {
    const entry = enemyById["living-armor"];
    const triggerRef = createRef<HTMLButtonElement>();
    render(
      <>
        <button ref={triggerRef}>Goblin</button>
        <EnemyTooltip
          entry={entry}
          enemyDescriptionContext={{ currentEnemy: entry, roomScalingMultiplier: 1.25, difficultyModifiers: [] }}
          labyrinthModifiers={["reinforced"]}
          triggerRef={triggerRef}
          visible
        />
      </>,
    );
    await waitFor(() => {
      const tooltip = document.querySelector(".hover-popup-panel[data-visible]");
      expect(tooltip?.textContent).toContain("Starts combat with 5 Armor");
      expect(tooltip?.textContent).toContain("gains 3 Block each turn");
    });
  });

  it("uses encounter values in traits and ability hover text, and restores catalog values without context", async () => {
    const entry = enemyById.goblin;
    const context = { currentEnemy: entry, roomScalingMultiplier: 1.25, difficultyModifiers: [] };
    const { rerender } = render(
      <EnemyInspectionOverlay
        open
        entry={entry}
        enemyDescriptionContext={context}
        modifiers={["reinforced"]}
        onClose={() => {}}
      />,
    );
    await waitForArtwork();
    const dialog = screen.getByRole("dialog", { name: "Goblin" });
    expect(dialog.querySelector('[data-trait="pilfer"]')?.textContent).toContain("Steals 1 Block");
    expect(dialog.querySelector('[data-trait="reinforced"]')?.textContent).toContain("gains 3 Block each turn");
    const ability = within(dialog).getByRole("button", { name: "Block" });
    fireEvent.mouseEnter(ability.parentElement!);
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain("Gain 6 Block"),
    );
    fireEvent.mouseLeave(ability.parentElement!);
    rerender(<EnemyInspectionOverlay open entry={entry} onClose={() => {}} />);
    expect(dialog.querySelector('[data-trait="pilfer"]')?.textContent).toContain("Steals 1 Block");
    fireEvent.mouseEnter(ability.parentElement!);
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain("Gain 5 Block"),
    );
  });

  it("updates live enemy attack power on hover without applying hero defenses", async () => {
    const entry = enemyById.goblin;
    const state = patchBattleState({
      currentEnemy: entry,
      enemyMitigation: { forge: 3 },
      playerStatuses: { block: 90, armor: 90 },
    });
    const { rerender } = render(<EnemyInspectionOverlay open entry={entry} battleState={state} onClose={() => {}} />);
    await waitForArtwork();
    const ability = screen.getByRole("button", { name: "Slash" });
    fireEvent.mouseEnter(ability.parentElement!);
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain(
        "Deal 10 Physical damage",
      ),
    );
    rerender(
      <EnemyInspectionOverlay
        open
        entry={entry}
        battleState={{ ...state, enemyMitigation: { ...state.enemyMitigation, forge: 5 } }}
        onClose={() => {}}
      />,
    );
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain(
        "Deal 12 Physical damage",
      ),
    );
  });

  it("uses portrait-only cards and standard tooltips without playing or flipping them", async () => {
    const onClose = vi.fn();
    render(<EnemyInspectionOverlay open entry={enemyById.inquisitor} modifiers={["tempered"]} onClose={onClose} />);
    await waitForArtwork();
    const dialog = screen.getByRole("dialog", { name: "Inquisitor" });
    const close = within(dialog).getByRole("button", { name: "Close enemy inspection" });
    expect(dialog.querySelector('[data-trait="tempered"]')?.getAttribute("data-trait-variant")).toBe("default");
    expect(
      new Set([...dialog.querySelectorAll("[data-trait]")].map((node) => node.getAttribute("data-trait-variant"))),
    ).toEqual(new Set(["default"]));
    expect(within(dialog).getByRole("heading", { name: "Traits" })).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Abilities" })).toBeTruthy();
    expect(
      within(dialog)
        .getAllByRole("img")
        .map((image) => image.getAttribute("alt")),
    ).toEqual(["Sunder", "Judgment", "Smite"]);
    expect(dialog.textContent).not.toContain("Deal 3 Physical damage");
    const ability = within(dialog).getByRole("button", { name: "Sunder" });
    fireEvent.mouseEnter(ability.parentElement!);
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain(
        "Deal 3 Physical damage",
      ),
    );
    expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain("Halve enemy Armor");
    fireEvent.click(ability);
    expect(within(ability).getByRole("img").getAttribute("alt")).toBe("Sunder");
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
