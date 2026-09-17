import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { KeywordTag } from "@/features/alchemy/shared/ui/keyword-tag";
import { keywordDefinitions } from "@/lib/game-data";

describe("KeywordTag", () => {
  afterEach(cleanup);

  it("colors nested keywords in the glossary tooltip", async () => {
    const { container } = render(<KeywordTag keywordId="thorns" showTooltip />);

    const trigger = container.querySelector("span.relative.inline-flex.items-center");
    expect(trigger).toBeTruthy();
    fireEvent.mouseEnter(trigger!);

    await waitFor(() => {
      expect(document.querySelector(".hover-popup-panel[data-visible]")).toBeTruthy();
    });
    const tooltip = document.querySelector<HTMLElement>(".hover-popup-panel[data-visible]");
    expect(tooltip?.textContent).toContain("When hit, Consume Thorns to deal Nature damage");
    expect(screen.getByText("Consume").className).toContain(keywordDefinitions.consume.colorClass);
    expect(screen.getByText("Nature").className).toContain(keywordDefinitions.nature.colorClass);
  });

  it("renders pill chip with centered alignment and bold stroke icon", () => {
    const { container } = render(<KeywordTag keywordId="block" pill />);

    const tag = container.querySelector("span");
    expect(tag).toBeTruthy();
    expect(tag?.className).toContain("items-center");
    expect(tag?.className).toContain("rounded-full");
    expect(tag?.className).toContain("character-keyword-pill-tint");

    const svg = tag?.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("stroke-width")).toBe("2.5");
    expect(svg?.getAttribute("class")).toContain("top-0");
    expect(svg?.getAttribute("class")).toContain("h-3");
    expect(svg?.getAttribute("class")).toContain("w-3");
  });
});
