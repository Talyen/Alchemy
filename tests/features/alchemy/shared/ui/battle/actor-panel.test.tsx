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

    rerender(<ArtPanel {...baseProps} isDead />);

    expect(screen.getByTestId("battle-player-art-panel").classList.contains("card-hover-scale")).toBe(false);
  });

  it("fades the art frame border when death starts", () => {
    render(<ArtPanel {...baseProps} isDead />);

    const artPanel = screen.getByTestId("battle-player-art-panel");
    expect(artPanel.classList.contains("border-transparent")).toBe(true);
    expect(artPanel.classList.contains("transition-[border-color]")).toBe(true);
  });
});
