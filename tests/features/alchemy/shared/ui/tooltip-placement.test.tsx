// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TooltipPanel } from "@/features/alchemy/shared/ui/tooltip-panel";

describe("TooltipPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("anchors above by default and below when placement is below", () => {
    const { rerender } = render(
      <div className="relative">
        <TooltipPanel visible>Body</TooltipPanel>
      </div>,
    );

    const panel = screen.getByText("Body");
    expect(panel.className).toContain("bottom-full");
    expect(panel.getAttribute("data-placement")).toBe("above");

    rerender(
      <div className="relative">
        <TooltipPanel visible placement="below">
          Body
        </TooltipPanel>
      </div>,
    );

    expect(panel.className).toContain("top-full");
    expect(panel.getAttribute("data-placement")).toBe("below");
  });
});
