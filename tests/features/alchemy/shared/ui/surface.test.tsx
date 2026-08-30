import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Surface } from "@/features/alchemy/shared/ui/surface";

describe("Surface", () => {
  afterEach(cleanup);

  it("renders as a div with base surface class by default", () => {
    render(<Surface testId="surface">Content</Surface>);

    const surface = screen.getByTestId("surface");
    expect(surface.tagName).toBe("DIV");
    expect(surface.classList.contains("surface")).toBe(true);
    expect(surface.style.getPropertyValue("--card-base-transform")).toBe("translate3d(0px, 0px, 0px)");
  });

  it("renders as a button when specified", () => {
    render(
      <Surface as="button" testId="surface-btn" ariaLabel="Action">
        Button Content
      </Surface>,
    );

    const button = screen.getByRole("button", { name: "Action" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.classList.contains("surface")).toBe(true);
  });

  it("applies selection ring and disabled styles", () => {
    render(
      <Surface as="button" testId="surface-btn" selected disabled>
        Selected Disabled
      </Surface>,
    );

    const button = screen.getByTestId("surface-btn");
    expect(button.classList.contains("card-interactive-selected")).toBe(true);
    expect(button.classList.contains("cursor-default")).toBe(true);
    expect(button.classList.contains("grayscale")).toBe(true);
  });

  it("clips contents by default in a surface-clip container", () => {
    render(
      <Surface testId="surface">
        <span>Child</span>
      </Surface>,
    );

    const surface = screen.getByTestId("surface");
    const clipContainer = surface.querySelector(".surface-clip");
    expect(clipContainer).not.toBeNull();
    expect(clipContainer?.textContent).toBe("Child");
  });

  it("supports click and keyboard activation when onDivClick is provided", () => {
    let clicked = 0;
    render(
      <Surface testId="clickable-div" onDivClick={() => clicked++} ariaLabel="Interactive Surface">
        Div Content
      </Surface>,
    );

    const el = screen.getByRole("button", { name: "Interactive Surface" });
    expect(el.tabIndex).toBe(0);

    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(clicked).toBe(1);

    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(clicked).toBe(2);

    el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(clicked).toBe(3);
  });
});
