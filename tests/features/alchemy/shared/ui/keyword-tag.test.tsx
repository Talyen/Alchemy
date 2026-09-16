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
});
