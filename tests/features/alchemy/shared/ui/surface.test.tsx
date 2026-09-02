import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Surface } from "@/features/alchemy/shared/ui/surface";

afterEach(() => cleanup());

describe("Surface", () => {
  it("renders as button with hover scale attribute", () => {
    render(
      <Surface as="button" ariaLabel="Play" hoverScaleActive className="extra">
        content
      </Surface>,
    );
    const btn = screen.getByRole("button", { name: "Play" });
    expect(btn.dataset.hovered).toBe("true");
    expect(btn.className).toContain("surface");
    expect(btn.className).toContain("extra");
  });

  it("renders as div with button role when onDivClick is provided", async () => {
    const onDivClick = vi.fn();
    render(
      <Surface onDivClick={onDivClick} ariaLabel="Open">
        content
      </Surface>,
    );
    const el = screen.getByRole("button", { name: "Open" });
    expect(el.tagName).toBe("DIV");
    expect(el.getAttribute("tabIndex")).toBe("0");
    await userEvent.click(el);
    expect(onDivClick).toHaveBeenCalledOnce();
  });

  it("handles Enter and Space on div role", async () => {
    const onDivClick = vi.fn();
    const { container } = render(
      <Surface onDivClick={onDivClick} ariaLabel="Action">
        content
      </Surface>,
    );
    const el = container.querySelector("div[role='button']") as HTMLElement;
    el.focus();
    await userEvent.keyboard("{Enter}");
    expect(onDivClick).toHaveBeenCalledTimes(1);
    await userEvent.keyboard(" ");
    expect(onDivClick).toHaveBeenCalledTimes(2);
  });

  it("applies dragging and disabled styles", () => {
    const { container } = render(
      <Surface dragging disabled>
        x
      </Surface>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("opacity-0");
    expect(el.className).toContain("grayscale");
  });

  it("forwards selected ring and data-count", () => {
    const { container } = render(
      <Surface selected dataCount={3}>
        x
      </Surface>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("card-interactive-selected");
    expect(el.getAttribute("data-count")).toBe("3");
  });

  it("disables button when disabled", () => {
    render(
      <Surface as="button" disabled ariaLabel="Disabled">
        x
      </Surface>,
    );
    expect(screen.getByRole("button", { name: "Disabled" }).hasAttribute("disabled")).toBe(true);
  });

  it("sets aria-disabled on div when disabled", () => {
    const { container } = render(
      <Surface disabled onDivClick={vi.fn()} ariaLabel="Div disabled">
        x
      </Surface>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("aria-disabled")).toBe("true");
  });
});
