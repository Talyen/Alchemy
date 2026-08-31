import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeDefined();
  });

  it("fires onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders as disabled", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies default variant and size by default", () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("h-14");
  });

  it("applies destructive variant", () => {
    const { container } = render(<Button variant="destructive">Danger</Button>);
    const button = container.querySelector("button")!;
    expect(button.className).toContain("bg-destructive");
  });

  it("applies outline variant", () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    const button = container.querySelector("button")!;
    expect(button.className).toContain("border-border/80");
    expect(button.className).toContain("hover:bg-muted/80");
    expect(button.className).not.toContain("hover:brightness-105");
  });

  it("applies primary hover lift without scale", () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    const button = container.querySelector("button")!;
    expect(button.className).toContain("button-primary-bloom");
    expect(button.className).not.toContain("scale");
  });

  it("applies press feedback on primary variant", () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    const button = container.querySelector("button")!;
    expect(button.className).toContain("active:bg-primary/90");
  });

  it("applies sm size", () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const button = container.querySelector("button")!;
    expect(button.className).toContain("h-11");
  });

  it("applies lg size", () => {
    const { container } = render(<Button size="lg">Large</Button>);
    const button = container.querySelector("button")!;
    expect(button.className).toContain("h-16");
  });

  it("applies icon size", () => {
    const { container } = render(<Button size="icon">X</Button>);
    const button = container.querySelector("button")!;
    expect(button.className).toContain("h-14");
    expect(button.className).toContain("w-14");
  });

  it("applies primary variant alias", () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    const button = container.querySelector("button")!;
    expect(button.className).toContain("bg-primary");
  });

  it("wraps in span only when wrapperClassName is provided", () => {
    const { container: without } = render(<Button>Wrapped</Button>);
    expect(without.firstChild?.nodeName).toBe("BUTTON");
    cleanup();
    const { container: withWrapper } = render(<Button wrapperClassName="my-wrap">Wrapped</Button>);
    const wrapper = withWrapper.firstChild as HTMLElement;
    expect(wrapper?.className).toContain("inline-flex");
    expect(wrapper?.className).toContain("my-wrap");
    expect(wrapper?.tagName).toBe("SPAN");
  });

  it("renders as Slot when asChild is true", () => {
    const { container } = render(
      <Button asChild>
        <a href="/test">Link</a>
      </Button>,
    );
    expect(container.querySelector("a")).toBeDefined();
    expect(container.querySelector("button")).toBeNull();
  });

  it("wraps Slot in span when asChild and wrapperClassName are both provided", () => {
    const { container } = render(
      <Button asChild wrapperClassName="slot-wrapper">
        <a href="/test">Link</a>
      </Button>,
    );
    const span = container.querySelector("span.slot-wrapper");
    expect(span).toBeDefined();
    expect(span?.querySelector("a")).toBeDefined();
  });
});
