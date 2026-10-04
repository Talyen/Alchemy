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

  it("uses native button activation and blocks it while disabled", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Surface as="button" onClick={onClick} ariaLabel="Open" />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Open" });
    await user.tab();
    await user.keyboard("{Enter} ");
    expect(onClick).toHaveBeenCalledTimes(2);
    rerender(<Surface as="button" disabled onClick={onClick} ariaLabel="Open" />);
    await user.click(button);
    await user.keyboard("{Enter} ");
    expect(onClick).toHaveBeenCalledTimes(2);
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
