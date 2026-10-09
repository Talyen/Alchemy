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

  it("scales living actor art but keeps dead actor art static", () => {
    const { rerender } = render(<ArtPanel {...baseProps} />);

    expect(screen.getByTestId("battle-player-art-panel").classList.contains("card-hover-scale")).toBe(true);
    expect(screen.getByTestId("combatant-attack-lunge")).toBeTruthy();

    rerender(<ArtPanel {...baseProps} isDead />);

    expect(screen.getByTestId("battle-player-art-panel").classList.contains("card-hover-scale")).toBe(false);
  });

  it("uses compact enemy traits and encounter modifiers while capitalizing description keywords", async () => {
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
      expect(tooltip?.querySelector('[data-trait="thorns"]')?.getAttribute("data-trait-variant")).toBe("compact");
      expect(tooltip?.querySelector('[data-trait="tempered"]')?.getAttribute("data-trait-variant")).toBe("compact");
    });
  });

  it.each(["player", "enemy"] as const)("keeps the %s turn border without adding a hover border", (side) => {
    const { getByTestId } = render(
      <ArtPanel {...baseProps} side={side} currentEnemy={side === "enemy" ? enemy : undefined} turnActive />,
    );
    const art = getByTestId(`battle-${side}-art-panel`);
    expect(art.classList.contains("combatant-art")).toBe(true);
    expect(art.classList.contains("card-hover-scale")).toBe(true);

    fireEvent.mouseEnter(art.parentElement!);

    expect(getByTestId(`turn-badge-${side}`).getAttribute("data-active")).toBe("true");
    expect(art.querySelectorAll(".shine-border")).toHaveLength(1);
  });

  it("renders artCorner and health stats inside the combatant-attack-lunge wrapper", () => {
    const { getByTestId } = render(
      <ArtPanel {...baseProps} artCorner={<div data-testid="test-companion-corner">companion</div>} />,
    );

    const lunge = getByTestId("combatant-attack-lunge");
    const corner = getByTestId("test-companion-corner");
    const artPanel = getByTestId("battle-player-art-panel");
    const health = getByTestId("player-health");
    const statuses = getByTestId("player-statuses");
    expect(lunge.contains(corner)).toBe(true);
    expect(lunge.contains(artPanel)).toBe(true);
    expect(lunge.contains(health)).toBe(true);
    expect(lunge.contains(statuses)).toBe(true);
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

  it.each([
    { amount: 1, periodic: false, healthLost: true, strength: "light" },
    { amount: 5, periodic: false, healthLost: true, strength: "normal" },
    { amount: 20, periodic: false, healthLost: true, strength: "heavy" },
    { amount: 20, periodic: true, healthLost: true, strength: "light" },
    { amount: 20, periodic: false, healthLost: false, strength: "light" },
  ])(
    "keeps $strength recoil on existing portrait artwork and away from Health",
    ({ amount, periodic, healthLost, strength }) => {
      const { rerender } = render(<ArtPanel {...baseProps} maxHealth={100} />);
      const art = screen.getByTestId("battle-player-art-panel");
      rerender(
        <ArtPanel
          {...baseProps}
          maxHealth={100}
          impactCue={{ sequence: 1, colors: ["#fff"], amount, periodic, healthLost, recoil: true }}
        />,
      );
      expect(screen.getByTestId("battle-player-art-panel")).toBe(art);
      expect(art.closest("[data-impact-strength]")?.getAttribute("data-impact-strength")).toBe(strength);
      expect(screen.getByTestId("player-health").closest(".portrait-recoil")).toBeNull();
    },
  );

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
