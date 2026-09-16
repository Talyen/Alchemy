import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { emptyInventory } from "@/lib/homestead/inventory";
import { HomesteadResourceWallet } from "@/features/alchemy/shared/ui/material-icons";

const LABELS = ["Gold", "Wood", "Stone", "Iron", "Food", "Herbs", "Hide", "Gems"];

// jsdom has no layout, so both metrics read 0 unless mocked. The hook treats
// that as unmeasurable and keeps full size.
function mockLabelMetrics() {
  const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const scrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth");
  Object.defineProperties(HTMLElement.prototype, {
    clientWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return this instanceof HTMLSpanElement ? 60 : 0;
      },
    },
    scrollWidth: {
      configurable: true,
      get(this: HTMLElement) {
        if (!(this instanceof HTMLSpanElement)) return 0;
        return this.textContent === "Gems" ? 80 : 40;
      },
    },
  });
  return () => {
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidth);
    if (scrollWidth) Object.defineProperty(HTMLElement.prototype, "scrollWidth", scrollWidth);
  };
}

describe("HomesteadResourceWallet", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all eight resources at full size when layout is unmeasurable", () => {
    render(<HomesteadResourceWallet gold={100} materialInventory={emptyInventory()} />);
    for (const label of LABELS) {
      const pill = screen.getByText(label);
      expect(pill.classList.contains("sm:text-sm")).toBe(true);
      expect(pill.getAttribute("title")).toBe(label);
    }
  });

  it("shrinks only the overflowing label instead of clipping it", () => {
    const restore = mockLabelMetrics();
    try {
      render(<HomesteadResourceWallet gold={100} materialInventory={emptyInventory()} />);
      const gems = screen.getByText("Gems");
      expect(gems.classList.contains("text-[11px]")).toBe(true);
      expect(gems.classList.contains("truncate")).toBe(true);
      expect(gems.getAttribute("title")).toBe("Gems");

      const wood = screen.getByText("Wood");
      expect(wood.classList.contains("sm:text-sm")).toBe(true);
      expect(wood.classList.contains("text-[11px]")).toBe(false);
    } finally {
      restore();
    }
  });
});
