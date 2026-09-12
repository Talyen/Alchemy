import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArtTurnActiveBorder } from "@/features/alchemy/shared/ui/battle/actor-panel-helpers";

afterEach(() => {
  cleanup();
});

function shineElement(testId: string): HTMLElement {
  const shine = screen.getByTestId(testId);
  expect(shine.className).toMatch(/\bshine-border\b/);
  return shine;
}

describe("ArtTurnActiveBorder", () => {
  it("shows an active turn border with the external 3px frame", () => {
    render(<ArtTurnActiveBorder side="player" active shineColor={["#ff0000", "#0000ff"]} />);
    const shine = shineElement("turn-badge-player");

    expect(shine.getAttribute("data-active")).toBe("true");
    expect(shine.style.getPropertyValue("--border-width")).toBe("3px");
    expect(shine.className).toMatch(/\bopacity-100\b/);
    expect(shine.className).not.toMatch(/\binset-0\b/);
    expect(shine.parentElement?.className ?? "").not.toMatch(/\binset-0\b/);
  });

  it("hides an inactive turn border without removing it", () => {
    render(<ArtTurnActiveBorder side="enemy" active={false} />);
    const shine = shineElement("turn-badge-enemy");

    expect(shine.getAttribute("data-active")).toBe("false");
    expect(shine.className).toMatch(/\bopacity-0\b/);
  });
});
