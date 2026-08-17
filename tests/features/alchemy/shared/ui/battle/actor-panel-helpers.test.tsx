// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getShineColorsForKeywords, SHINE_PALETTES } from "@/features/alchemy/shared/config";
import { ArtTurnActiveBorder } from "@/features/alchemy/shared/ui/battle/actor-panel-helpers";
import { characters } from "@/lib/game-data";

afterEach(() => {
  cleanup();
});

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function shineElement(testId: string): HTMLElement {
  const shine = screen.getByTestId(testId);
  expect(shine.className).toMatch(/\bshine-border\b/);
  return shine;
}

function shineBackground(testId: string): string {
  return shineElement(testId).style.backgroundImage;
}

function expectShineContains(testId: string, colors: readonly string[]) {
  const background = shineBackground(testId);
  for (const color of colors) {
    expect(background).toContain(hexToRgb(color));
  }
}

describe("ArtTurnActiveBorder", () => {
  it("uses the hero affinity palette for the player turn shine", () => {
    const shineColors = getShineColorsForKeywords(characters.knight.keywords);
    render(<ArtTurnActiveBorder side="player" active shineColor={shineColors} />);
    expectShineContains("turn-badge-player", shineColors);
  });

  it("uses gold and black for Wildcard player turn shine", () => {
    const shineColors = getShineColorsForKeywords(characters.wildcard.keywords);
    render(<ArtTurnActiveBorder side="player" active shineColor={shineColors} />);

    expect(shineColors).toEqual([...SHINE_PALETTES.wildcard]);
    expectShineContains("turn-badge-player", SHINE_PALETTES.wildcard);
  });

  it("keeps the enemy turn shine on the enemy palette", () => {
    render(<ArtTurnActiveBorder side="enemy" active />);
    expectShineContains("turn-badge-enemy", SHINE_PALETTES.turnEnemy);
  });

  it("uses an opaque 3px shine without an inset wrapper", () => {
    render(<ArtTurnActiveBorder side="player" active />);
    const shine = shineElement("turn-badge-player");

    expect(shine.style.getPropertyValue("--border-width")).toBe("3px");
    expect(shine.className).toMatch(/\bopacity-100\b/);
    expect(shine.className).not.toMatch(/\bopacity-70\b/);
    expect(shine.className).not.toMatch(/\binset-0\b/);
    expect(shine.parentElement?.className ?? "").not.toMatch(/\binset-0\b/);
  });
});
