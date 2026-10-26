import { createRef, type FormEvent } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

describe("Button", () => {
  it.each([undefined, "my-wrap"])("forwards native button props and refs with wrapper %s", async (wrapperClassName) => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    const { container } = render(
      <Button
        ref={ref}
        wrapperClassName={wrapperClassName}
        type="button"
        aria-pressed="true"
        name="action"
        value="confirm"
        onClick={onClick}
      >
        Confirm
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Confirm", pressed: true });
    expect(button.tagName).toBe("BUTTON");
    expect(ref.current).toBe(button);
    expect(button.getAttribute("type")).toBe("button");
    expect(button.getAttribute("name")).toBe("action");
    expect(button.getAttribute("value")).toBe("confirm");
    if (wrapperClassName) {
      const wrapper = button.parentElement;
      expect(wrapper).toBe(container.firstElementChild);
      expect(wrapper?.tagName).toBe("SPAN");
      expect(wrapper?.classList.contains(wrapperClassName)).toBe(true);
      expect(button.classList.contains(wrapperClassName)).toBe(false);
    } else {
      expect(container.firstElementChild).toBe(button);
    }
    const user = userEvent.setup();
    await user.click(button);
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it.each([undefined, "my-wrap"])("prevents disabled activation with wrapper %s", async (wrapperClassName) => {
    const onClick = vi.fn();
    render(
      <Button disabled wrapperClassName={wrapperClassName} onClick={onClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button.hasAttribute("disabled")).toBe(true);
    const user = userEvent.setup();
    await user.click(button);
    await user.tab();
    expect(document.activeElement).not.toBe(button);
    await user.keyboard("{Enter} ");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("avoids accidental form submits and preserves explicit submit and reset", async () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const onReset = vi.fn();
    const form = (type?: "submit" | "reset") => (
      <form onSubmit={onSubmit} onReset={onReset}>
        <Button type={type}>Action</Button>
      </form>
    );
    const { rerender } = render(form());
    const button = screen.getByRole("button", { name: "Action" });
    expect(button.getAttribute("type")).toBe("button");
    await userEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();

    for (const type of ["submit", "reset"] as const) {
      rerender(form(type));
      await userEvent.click(button);
    }
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledOnce();
  });
});
