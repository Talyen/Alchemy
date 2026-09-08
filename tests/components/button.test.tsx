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
      expect(wrapper?.classList.contains("inline-flex")).toBe(true);
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

  it.each([undefined, "button", "submit", "reset"] as const)(
    "preserves native form behavior for type %s",
    async (type) => {
      const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
      const onReset = vi.fn();
      render(
        <form onSubmit={onSubmit} onReset={onReset}>
          <Button type={type}>Action</Button>
        </form>,
      );
      const button = screen.getByRole("button", { name: "Action" });
      expect(button.getAttribute("type")).toBe(type ?? null);
      await userEvent.click(button);
      expect(onSubmit).toHaveBeenCalledTimes(type === undefined || type === "submit" ? 1 : 0);
      expect(onReset).toHaveBeenCalledTimes(type === "reset" ? 1 : 0);
    },
  );

  it("applies caller overrides to the button independently of its wrapper", () => {
    render(
      <Button className="h-20 bg-muted" wrapperClassName="h-24">
        Override
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button.classList.contains("h-20")).toBe(true);
    expect(button.classList.contains("bg-muted")).toBe(true);
    expect(button.classList.contains("h-14")).toBe(false);
    expect(button.classList.contains("bg-primary")).toBe(false);
    expect(button.classList.contains("h-24")).toBe(false);
    expect(button.parentElement?.classList.contains("h-24")).toBe(true);
  });
});
