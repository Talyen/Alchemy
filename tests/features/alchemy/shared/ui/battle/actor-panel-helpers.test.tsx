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

function shineBackground(testId: string): string {
  const shine = screen.getByTestId(testId).querySelector(".shine-border");
  expect(shine).not.toBeNull();
  return (shine as HTMLElement).style.backgroundImage;
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
});
