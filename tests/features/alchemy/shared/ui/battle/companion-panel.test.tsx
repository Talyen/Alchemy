import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getKeywordListShineColors } from "@/features/alchemy/shared/config";
import { CompanionPanel } from "@/features/alchemy/shared/ui/battle/companion-panel";
import { companionLibrary, keywordDefinitions } from "@/lib/game-data";

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

describe("CompanionPanel turn shine border", () => {
  it("renders shine border with opacity-100 when turnActive is true", () => {
    render(<CompanionPanel companion={companionLibrary.wolf} turnActive />);
    const shine = shineElement("turn-badge-companion");

    expect(shine.getAttribute("data-active")).toBe("true");
    expect(shine.className).toMatch(/\bopacity-100\b/);
    expect(shine.className).not.toMatch(/\bopacity-0\b/);
  });

  it("renders shine border with opacity-0 when turnActive is false", () => {
    render(<CompanionPanel companion={companionLibrary.wolf} turnActive={false} />);
    const shine = shineElement("turn-badge-companion");

    expect(shine.getAttribute("data-active")).toBe("false");
    expect(shine.className).toMatch(/\bopacity-0\b/);
  });

  it("uses bleed keyword shine colors for wolf companion", () => {
    render(<CompanionPanel companion={companionLibrary.wolf} turnActive />);
    const expectedColors = getKeywordListShineColors(["bleed"]);
    expectShineContains("turn-badge-companion", expectedColors);
  });

  it("uses burn keyword shine colors for phoenix companion", () => {
    render(<CompanionPanel companion={companionLibrary.phoenix} turnActive />);
    const expectedColors = getKeywordListShineColors(["burn"]);
    expectShineContains("turn-badge-companion", expectedColors);
  });

  it("uses freeze keyword shine colors for frost whelp companion", () => {
    render(<CompanionPanel companion={companionLibrary["frost-whelp"]} turnActive />);
    const expectedColors = getKeywordListShineColors(["freeze"]);
    expectShineContains("turn-badge-companion", expectedColors);
  });

  it("uses bleed and gold keyword shine colors for fox companion", () => {
    render(<CompanionPanel companion={companionLibrary.fox} turnActive />);
    const expectedColors = getKeywordListShineColors(["bleed", "gold"]);
    expectShineContains("turn-badge-companion", expectedColors);
  });

  it("uses companion keyword palette fallback for will-o-wisp", () => {
    render(<CompanionPanel companion={companionLibrary["will-o-wisp"]} turnActive />);
    expectShineContains("turn-badge-companion", keywordDefinitions.companion.shineColors);
  });

  it("allows custom turnShineColors override if provided", () => {
    const customColors = ["#123456", "#654321"];
    render(<CompanionPanel companion={companionLibrary.wolf} turnActive turnShineColors={customColors} />);
    expectShineContains("turn-badge-companion", customColors);
  });
});
