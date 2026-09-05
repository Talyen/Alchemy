import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/alchemy/shared/ui/battle/hurt-spark-burst", () => ({
  HurtSparkBurst: ({ colors }: { colors: readonly string[] }) => (
    <div data-testid="portrait-impact-sparks" data-colors={colors.join(",")} />
  ),
}));

import { ArtPanel } from "@/features/alchemy/shared/ui/battle/actor-panel";
import { getKeywordListShineColors } from "@/features/alchemy/shared/config";
import type { BestiaryEntry } from "@/lib/game-data";
import { installDisabledAnimationsForTests } from "../../../../../helpers/animation-test";

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
  attackEffects: [{ kind: "damage", damageType: "burn", amount: 2 }],
};

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

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

  it("shows the enemy keyword shine only while the enemy is hovered", () => {
    const { getByTestId, queryByTestId } = render(
      <ArtPanel
        {...baseProps}
        side="enemy"
        currentEnemy={enemy}
        currentEnemyAttackEffects={[{ kind: "damage", damageType: "freeze", amount: 1 }]}
      />,
    );
    const surface = getByTestId("battle-enemy-art-panel");
    const wrapper = surface.parentElement;
    expect(wrapper).not.toBeNull();
    expect(queryByTestId("keyword-shine-enemy")).toBeNull();

    fireEvent.mouseEnter(wrapper!);

    const shine = getByTestId("keyword-shine-enemy");
    expect(shine.className).toMatch(/\bshine-border\b/);
    for (const color of getKeywordListShineColors(["poison", "freeze"])) {
      expect(shine.style.backgroundImage).toContain(hexToRgb(color));
    }

    fireEvent.mouseLeave(wrapper!);
    expect(queryByTestId("keyword-shine-enemy")).toBeNull();
  });

  it("does not show the enemy keyword shine for dead enemies", () => {
    const { getByTestId, queryByTestId } = render(<ArtPanel {...baseProps} side="enemy" currentEnemy={enemy} isDead />);
    const wrapper = getByTestId("battle-enemy-art-panel").parentElement;
    expect(wrapper).not.toBeNull();

    fireEvent.mouseEnter(wrapper!);

    expect(queryByTestId("keyword-shine-enemy")).toBeNull();
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
      <ArtPanel {...baseProps} isDead impactCue={{ sequence: 1, colors: ["#67e8f9", "#06b6d4"], healthLost: true }} />,
    );

    expect(screen.getByTestId("portrait-impact-sparks").getAttribute("data-colors")).toBe("#67e8f9,#06b6d4");
    expect(screen.queryByTestId("portrait-health-loss-flash")).toBeNull();
  });

  it("keeps the red Health-loss flash for a living combatant", () => {
    const { rerender } = render(<ArtPanel {...baseProps} />);

    rerender(<ArtPanel {...baseProps} impactCue={{ sequence: 1, colors: ["#fb923c"], healthLost: true }} />);

    expect(screen.getByTestId("portrait-impact-sparks")).toBeTruthy();
    expect(screen.getByTestId("portrait-health-loss-flash")).toBeTruthy();
  });

  it("renders Block sparks without a Health-loss flash", () => {
    const { rerender } = render(<ArtPanel {...baseProps} />);

    rerender(<ArtPanel {...baseProps} impactCue={{ sequence: 1, colors: ["#7dd3fc"], healthLost: false }} />);

    expect(screen.getByTestId("portrait-impact-sparks")).toBeTruthy();
    expect(screen.queryByTestId("portrait-health-loss-flash")).toBeNull();
  });
});
