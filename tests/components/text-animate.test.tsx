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
});
