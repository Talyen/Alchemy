import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ShineBorder } from "@/components/ui/shine-border";

afterEach(cleanup);

describe("ShineBorder", () => {
  it("renders with single color formatting valid 2-stop radial gradient", () => {
    const { container } = render(<ShineBorder shineColor="#fcd34d" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeDefined();
    expect(el.style.backgroundColor).toContain("252, 211, 77");
    expect(el.style.backgroundImage).toContain("radial-gradient(");
    expect(el.style.backgroundImage).toContain("252, 211, 77");
  });

  it("renders with array of colors", () => {
    const { container } = render(<ShineBorder shineColor={["#fcd34d", "#d97706"]} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.backgroundImage).toContain("radial-gradient(");
    expect(el.style.backgroundImage).toContain("252, 211, 77");
    expect(el.style.backgroundImage).toContain("217, 119, 6");
  });

  it("handles empty color array with safe fallback", () => {
    const { container } = render(<ShineBorder shineColor={[]} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.backgroundImage).toContain("radial-gradient(");
    expect(el.style.backgroundImage).toContain("0, 0, 0");
  });
});
