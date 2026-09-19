import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ShineBorder } from "@/components/ui/shine-border";

afterEach(() => {
  cleanup();
});

describe("ShineBorder", () => {
  it("paints an opaque gradient and sits on the CSS border box", () => {
    const { container } = render(<ShineBorder shineColor={["#ff0000", "#00ff00"]} borderWidth={3} />);
    const shine = container.querySelector(".shine-border") as HTMLElement;

    expect(shine.className).not.toMatch(/\binset-0\b/);
    expect(shine.querySelector(".shine-border-paint")?.className).toMatch(/\boverflow-hidden\b/);
    expect(shine.className).toMatch(/rounded-\[inherit\]/);
    expect(shine.querySelector<HTMLElement>(".shine-border-paint")!.style.backgroundImage).toContain("rgb(255, 0, 0)");
    expect(shine.querySelector<HTMLElement>(".shine-border-paint")!.style.backgroundImage).toContain("rgb(0, 255, 0)");
    expect(shine.querySelector<HTMLElement>(".shine-border-paint")!.style.backgroundColor).toBe("rgb(255, 0, 0)");
    expect(shine.querySelector<HTMLElement>(".shine-border-paint")!.style.backgroundImage).not.toContain("rgba");
    expect(shine.querySelector<HTMLElement>(".shine-border-paint")!.style.backgroundImage).not.toContain("color-mix");
    expect(shine.querySelector<HTMLElement>(".shine-border-paint")!.style.backgroundImage).not.toContain("transparent");
  });
  it("renders a border-only shine with no outer glow", () => {
    const { container, rerender } = render(<ShineBorder shineColor={["#cbd5e1", "#64748b"]} />);
    const shine = container.querySelector<HTMLElement>(".shine-border")!;
    expect(shine.hasAttribute("data-glow")).toBe(false);
    expect(shine.style.getPropertyValue("--shine-glow-color")).toBe("");
    expect(shine.style.mask).toBe("");
    rerender(<ShineBorder shineColor={["#cbd5e1", "#64748b"]} />);
    expect(shine.hasAttribute("data-glow")).toBe(false);
    expect(container.querySelector(".shine-border-paint")).not.toBeNull();
  });

  it("hides decorative frames from assistive tech", () => {
    const { container } = render(<ShineBorder shineColor={["#ff0000", "#00ff00"]} />);
    expect(container.querySelector(".shine-border")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("falls back to neutral shine instead of black for an empty palette", () => {
    const { container } = render(<ShineBorder shineColor={[]} />);
    const paint = container.querySelector<HTMLElement>(".shine-border-paint")!;
    expect(paint.style.backgroundColor).toBe("rgb(203, 213, 225)");
    expect(paint.style.backgroundImage).not.toContain("0, 0, 0");
  });
});
