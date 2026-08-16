// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CyclingShineBorder } from "@/features/alchemy/shared/ui/cycling-shine-border";
import { buildShineColorCycleKeyframes } from "@/features/alchemy/shared/ui/cycling-shine-keyframes";

afterEach(() => {
  cleanup();
});

describe("buildShineColorCycleKeyframes", () => {
  it("glides from each color to the next and loops back to the first", () => {
    const css = buildShineColorCycleKeyframes("test-cycle", ["#ff0000", "#00ff00"]);
    expect(css).toContain("0% { --cycle-shine: #ff0000; }");
    expect(css).toContain("50% { --cycle-shine: #00ff00; }");
    expect(css).toContain("100% { --cycle-shine: #ff0000; }");
  });
});

describe("CyclingShineBorder", () => {
  it("drives the shine from an interpolatable color variable", () => {
    const { container } = render(<CyclingShineBorder colors={["#ff0000", "#00ff00"]} intervalMs={1000} />);
    const shine = container.querySelector(".shine-border") as HTMLElement;
    expect(shine.style.backgroundImage).toBe("radial-gradient(var(--cycle-shine))");
    expect(shine.style.backgroundColor).toBe("var(--cycle-shine)");
    expect(shine.style.animation).toContain("linear infinite");
  });
});
