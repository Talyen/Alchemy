import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Surface } from "@/features/alchemy/shared/ui/surface";

afterEach(() => cleanup());

describe("Surface", () => {
  it("makes a div action focusable and activates it with pointer, Enter, and Space", async () => {
    const onDivClick = vi.fn();
    render(
      <Surface onDivClick={onDivClick} ariaLabel="Open">
        content
      </Surface>,
    );
    const action = screen.getByRole("button", { name: "Open" });
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(action);
    await user.keyboard("{Enter}");
    expect(onDivClick).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(onDivClick).toHaveBeenCalledTimes(2);
    await user.click(action);
    expect(onDivClick).toHaveBeenCalledTimes(3);
  });

  it("disables button when disabled", () => {
    render(
      <Surface as="button" disabled ariaLabel="Disabled">
        x
      </Surface>,
    );
    expect(screen.getByRole("button", { name: "Disabled" }).hasAttribute("disabled")).toBe(true);
  });

  it("prevents pointer and keyboard activation on a disabled div", async () => {
    const onDivClick = vi.fn();
    const { container } = render(
      <Surface disabled onDivClick={onDivClick} ariaLabel="Div disabled">
        x
      </Surface>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("aria-disabled")).toBe("true");
    expect(el.tabIndex).toBe(-1);
    await userEvent.click(el);
    el.tabIndex = 0;
    el.focus();
    await userEvent.keyboard("{Enter} ");
    expect(onDivClick).not.toHaveBeenCalled();
  });
});
