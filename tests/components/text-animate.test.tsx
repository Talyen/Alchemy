import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TextAnimate } from "@/components/ui/text-animate";

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("TextAnimate", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders text with accessible aria-label", () => {
    render(<TextAnimate>Enter the labyrinth</TextAnimate>);
    const paragraph = screen.getByLabelText("Enter the labyrinth");
    expect(paragraph).toBeDefined();
    expect(paragraph.textContent).toContain("Enter");
    expect(paragraph.textContent).toContain("the");
    expect(paragraph.textContent).toContain("labyrinth");
  });

  it("splits text into separate word tokens", () => {
    const { container } = render(<TextAnimate>Three words here</TextAnimate>);
    const wordSpans = container.querySelectorAll("span.inline-block");
    expect(wordSpans.length).toBeGreaterThanOrEqual(3);
  });

  it("applies custom className", () => {
    const { container } = render(<TextAnimate className="text-xl text-primary">Custom text</TextAnimate>);
    const paragraph = container.querySelector("p");
    expect(paragraph?.className).toContain("text-xl");
    expect(paragraph?.className).toContain("text-primary");
  });

  it("handles empty or whitespace strings gracefully", () => {
    const { container } = render(<TextAnimate> </TextAnimate>);
    const paragraph = container.querySelector("p");
    expect(paragraph).toBeDefined();
  });
});
