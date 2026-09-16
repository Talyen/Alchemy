import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getCompanionShineColors } from "@/features/alchemy/shared/config";
import { CompanionPanel } from "@/features/alchemy/shared/ui/battle/companion-panel";
import { companionLibrary } from "@/lib/game-data";

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
  return shineElement(testId).querySelector<HTMLElement>(".shine-border-paint")!.style.backgroundImage;
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

  it("uses companion keyword shine colors for wolf companion", () => {
    render(<CompanionPanel companion={companionLibrary.wolf} turnActive />);
    const expectedColors = getCompanionShineColors(companionLibrary.wolf);
    expectShineContains("turn-badge-companion", expectedColors);
  });

  it("allows custom turnShineColors override if provided", () => {
    const customColors = ["#123456", "#654321"];
    render(<CompanionPanel companion={companionLibrary.wolf} turnActive turnShineColors={customColors} />);
    expectShineContains("turn-badge-companion", customColors);
  });
});
