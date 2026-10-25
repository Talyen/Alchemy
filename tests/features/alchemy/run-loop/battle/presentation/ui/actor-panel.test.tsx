import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/alchemy/run-loop/battle/presentation/ui/hurt-spark-burst", () => ({
  HurtSparkBurst: ({ colors }: { colors: readonly string[] }) => (
    <div data-testid="portrait-impact-sparks" data-colors={colors.join(",")} />
  ),
}));

import { ArtPanel } from "@/features/alchemy/run-loop/battle/presentation/ui/actor-panel";
import type { BestiaryEntry } from "@/lib/game-data/index";
import { installDisabledAnimationsForTests } from "../../../../../../helpers/animation-test";
import { installFocusInputForTests } from "../../../../../../helpers/focus-input-test";

installFocusInputForTests(true);

const baseProps = {
  side: "player" as const,
  title: "Alchemist",
  art: "alchemist.png",
  health: 20,
  maxHealth: 20,
  statuses: [],
  shimmerId: "player",
  shimmerActive: false,
  shimmerToken: undefined,
  onHoverShimmer: vi.fn(),
};

const enemy: BestiaryEntry = {
  id: "test-enemy",
  title: "Test Enemy",
  subtitle: "Normal",
  descriptionLines: [],
  art: "enemy.png",
  enemyType: "normal",
  traits: [{ id: "spores", title: "Spores", description: "Applies Poison to the hero." }],
  abilityIds: ["frostbolt"],
};

describe("ArtPanel hover motion", () => {
  installDisabledAnimationsForTests();

  afterEach(cleanup);

  it.each([
    { id: "earth-elemental", side: "enemy", mirrored: true },
    { id: "stone-titan", side: "enemy", mirrored: true },
    { id: "goblin", side: "enemy", mirrored: false },
    { id: "earth-elemental", side: "player", mirrored: false },
  ] as const)("orients $id artwork on the $side side without mirroring its UI", ({ id, side, mirrored }) => {
    render(<ArtPanel {...baseProps} side={side} title={enemy.title} currentEnemy={{ ...enemy, id }} />);
    const image = screen.getByRole("img", { name: enemy.title });
    expect(image.classList.contains("-scale-x-100")).toBe(mirrored);
    expect(screen.getByTestId(`battle-${side}-art-panel`).classList.contains("-scale-x-100")).toBe(false);
  });

  it("shows the remaining Death's Door protection and its survival rules", async () => {
    const { rerender } = render(<ArtPanel {...baseProps} deathsDoorActive deathsDoorGraceTurnsRemaining={3} />);
    fireEvent.focus(screen.getByRole("button", { name: "Death's Door: 3 protected turns remaining" }));
    await waitFor(() => {
      const tooltip = document.querySelector(".hover-popup-panel[data-visible]");
      expect(tooltip?.textContent).toContain("3 protected turns remaining.");
      expect(tooltip?.textContent).toContain(
        "Death's Door keeps you at 1 Health when taking fatal damage while protected.",
      );
      expect(tooltip?.textContent).toContain("Triggers once per combat.");
    });
    rerender(<ArtPanel {...baseProps} deathsDoorActive deathsDoorGraceTurnsRemaining={1} />);
    expect(screen.getByRole("button", { name: "Death's Door: 1 protected turn remaining" })).toBeTruthy();
    await waitFor(() =>
      expect(document.querySelector(".hover-popup-panel[data-visible]")?.textContent).toContain(
        "1 protected turn remaining.",
      ),
    );
    rerender(<ArtPanel {...baseProps} deathsDoorActive={false} deathsDoorGraceTurnsRemaining={null} />);
    expect(screen.queryByRole("button", { name: /Death's Door/ })).toBeNull();
  });

  it("shows enemy traits and encounter modifiers while capitalizing description keywords", async () => {
    const entry = {
      ...enemy,
      traits: [{ id: "thorns", title: "Thorns", description: "When hit, consume Thorns" }],
    } satisfies BestiaryEntry;
    render(<ArtPanel {...baseProps} side="enemy" currentEnemy={entry} activeLabyrinthModifiers={["tempered"]} />);

    const wrapper = screen.getByTestId("battle-enemy-art-panel").parentElement;
    expect(wrapper).not.toBeNull();
    fireEvent.mouseEnter(wrapper!);

    await waitFor(() => {
      const tooltip = document.querySelector<HTMLElement>(".hover-popup-panel[data-visible]");
      expect(tooltip?.textContent).toContain("When hit, Consume Thorns");
      expect(tooltip?.textContent).not.toContain("consume");
      expect(tooltip?.querySelector('[data-trait="thorns"]')).toBeTruthy();
      expect(tooltip?.querySelector('[data-trait="tempered"]')).toBeTruthy();
    });
  });

  it("removes crowd-control presentation before the death slice starts", () => {
    const { rerender } = render(<ArtPanel {...baseProps} ccKeyword="freeze" />);

    expect(screen.getByTestId("combatant-status-effect")).toBeTruthy();

    rerender(<ArtPanel {...baseProps} ccKeyword="freeze" isDead />);

    expect(screen.queryByTestId("combatant-status-effect")).toBeNull();
  });

  it("renders a lethal impact burst over the death slice without a Health-loss flash", () => {
    const { rerender } = render(<ArtPanel {...baseProps} />);

    rerender(
      <ArtPanel
        {...baseProps}
        isDead
        impactCue={{
          sequence: 1,
          colors: ["#67e8f9", "#06b6d4"],
          healthLost: true,
          amount: 5,
          periodic: false,
          recoil: true,
        }}
      />,
    );

    expect(screen.getByTestId("portrait-impact-sparks").getAttribute("data-colors")).toBe("#67e8f9,#06b6d4");
    expect(screen.queryByTestId("portrait-health-loss-flash")).toBeNull();
  });

  it("restarts the Health-loss flash for rapid hits even when recoil is suppressed", () => {
    const { rerender } = render(<ArtPanel {...baseProps} />);

    rerender(
      <ArtPanel
        {...baseProps}
        impactCue={{ sequence: 1, colors: ["#fb923c"], healthLost: true, amount: 5, periodic: false, recoil: true }}
      />,
    );

    expect(screen.getByTestId("portrait-impact-sparks")).toBeTruthy();
    const flash = screen.getByTestId("portrait-health-loss-flash");
    rerender(
      <ArtPanel
        {...baseProps}
        impactCue={{ sequence: 2, colors: ["#fb923c"], healthLost: true, amount: 5, periodic: false, recoil: false }}
      />,
    );
    expect(screen.getByTestId("portrait-health-loss-flash")).not.toBe(flash);
  });

  it("does not replay an old recoil on maximum Health changes or carry it into death", () => {
    const impactCue = { sequence: 1, colors: ["#fff"], healthLost: true, amount: 5, periodic: false, recoil: true };
    const { rerender } = render(<ArtPanel {...baseProps} />);
    rerender(<ArtPanel {...baseProps} impactCue={impactCue} />);
    const recoil = screen.getByTestId("battle-player-art-panel").closest(".portrait-recoil")!;
    expect(recoil.classList.contains("portrait-recoil-active")).toBe(true);
    const restart = vi.spyOn(recoil.classList, "add");
    rerender(<ArtPanel {...baseProps} maxHealth={30} impactCue={impactCue} />);
    expect(restart).not.toHaveBeenCalled();

    rerender(<ArtPanel {...baseProps} impactCue={{ ...impactCue, sequence: 2 }} />);
    expect(recoil.classList.contains("portrait-recoil-active")).toBe(true);
    rerender(<ArtPanel {...baseProps} isDead impactCue={{ ...impactCue, sequence: 3 }} />);
    expect(recoil.classList.contains("portrait-recoil-active")).toBe(false);
    restart.mockRestore();
  });

  it("renders Block sparks without a Health-loss flash", () => {
    const { rerender } = render(<ArtPanel {...baseProps} />);

    rerender(
      <ArtPanel
        {...baseProps}
        impactCue={{ sequence: 1, colors: ["#7dd3fc"], healthLost: false, amount: 5, periodic: false, recoil: true }}
      />,
    );

    expect(screen.getByTestId("portrait-impact-sparks")).toBeTruthy();
    expect(screen.queryByTestId("portrait-health-loss-flash")).toBeNull();
  });
});
