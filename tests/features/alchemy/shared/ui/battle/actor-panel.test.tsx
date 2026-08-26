// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArtPanel } from "@/features/alchemy/shared/ui/battle/actor-panel";
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
});
