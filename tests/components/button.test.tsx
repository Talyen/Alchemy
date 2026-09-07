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

  it("defaults to primary styling and standard size", () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole("button");
    expect(button.classList.contains("bg-primary")).toBe(true);
    expect(button.classList.contains("h-14")).toBe(true);
    expect(button.classList.contains("px-6")).toBe(true);
  });

  it.each([
    ["primary", ["bg-primary", "text-primary-foreground", "button-primary-bloom", "active:bg-primary/90"]],
    [
      "destructive",
      ["bg-destructive", "text-destructive-foreground", "hover:bg-destructive/90", "active:bg-destructive/90"],
    ],
    [
      "outline",
      ["border", "border-border/80", "bg-background", "text-foreground", "hover:bg-muted/80", "active:bg-muted/90"],
    ],
    ["ghost", ["border-0", "bg-transparent", "text-foreground", "hover:bg-muted/80", "active:bg-muted/90"]],
  ] as const)("preserves %s appearance and interaction styles", (variant, expectedClasses) => {
    render(<Button variant={variant}>Action</Button>);
    const button = screen.getByRole("button");
    for (const token of [
      ...expectedClasses,
      "active:brightness-100",
      "transition-[background-color,box-shadow]",
      "duration-150",
      "disabled:pointer-events-none",
      "disabled:opacity-50",
    ]) {
      expect(button.classList.contains(token)).toBe(true);
    }
    expect(button.className).not.toContain("scale");
    expect(button.className).not.toContain("hover:brightness-105");
  });

  it.each([
    ["default", ["h-14", "px-6", "text-base"]],
    ["sm", ["h-11", "px-4", "text-sm", "tracking-widest", "uppercase"]],
    ["lg", ["h-16", "px-7", "text-xl"]],
    ["icon", ["h-14", "w-14", "text-base"]],
  ] as const)("preserves %s sizing", (size, expectedClasses) => {
    render(<Button size={size}>Action</Button>);
    const button = screen.getByRole("button");
    for (const token of expectedClasses) {
      expect(button.classList.contains(token)).toBe(true);
    }
  });

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
