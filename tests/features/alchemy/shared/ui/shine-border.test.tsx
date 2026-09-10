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
  it("keeps persistent shine unlit until glow is requested", () => {
    const { container, rerender } = render(<ShineBorder shineColor={["#cbd5e1", "#64748b"]} />);
    const shine = container.querySelector<HTMLElement>(".shine-border")!;
    expect(shine.dataset.glow).toBeUndefined();
    rerender(<ShineBorder shineColor={["#cbd5e1", "#64748b"]} glow />);
    expect(shine.dataset.glow).toBe("true");
    expect(shine.style.getPropertyValue("--shine-glow-color")).toBe("#cbd5e1");
    expect(shine.style.mask).toBe("");
    rerender(<ShineBorder shineColor={["#cbd5e1", "#64748b"]} />);
    expect(shine.dataset.glow).toBeUndefined();
    expect(container.querySelector(".shine-border-paint")).not.toBeNull();
  });
});
