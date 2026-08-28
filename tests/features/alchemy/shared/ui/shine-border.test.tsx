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
    expect(shine.className).toMatch(/\boverflow-hidden\b/);
    expect(shine.className).toMatch(/rounded-\[inherit\]/);
    expect(shine.style.backgroundImage).toContain("rgb(255, 0, 0)");
    expect(shine.style.backgroundImage).toContain("rgb(0, 255, 0)");
    expect(shine.style.backgroundColor).toBe("rgb(255, 0, 0)");
    expect(shine.style.backgroundImage).not.toContain("rgba");
    expect(shine.style.backgroundImage).not.toContain("color-mix");
    expect(shine.style.backgroundImage).not.toContain("transparent");
  });
});
