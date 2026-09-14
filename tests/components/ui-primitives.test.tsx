import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { TextAnimate } from "@/components/ui/text-animate";

afterEach(cleanup);

describe("Switch", () => {
  it("reports controlled state changes in both directions", async () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(<Switch checked={false} onCheckedChange={onCheckedChange} />);
    const switchEl = screen.getByRole("switch");
    await userEvent.click(switchEl);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    rerender(<Switch checked onCheckedChange={onCheckedChange} />);
    expect(switchEl.getAttribute("aria-checked")).toBe("true");
    await userEvent.click(switchEl);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("does not fire when disabled", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} disabled onCheckedChange={onCheckedChange} />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl.hasAttribute("disabled")).toBe(true);
    await userEvent.click(switchEl);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});

describe("Progress", () => {
  function getFill(container: HTMLElement): HTMLElement {
    return container.firstChild!.firstChild as HTMLElement;
  }

  it("sets width based on value", () => {
    const { container } = render(<Progress value={50} />);
    expect(getFill(container).style.width).toBe("50%");
  });

  it("clamps value above 100", () => {
    const { container } = render(<Progress value={150} />);
    expect(getFill(container).style.width).toBe("100%");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  });

  it("clamps value below 0", () => {
    const { container } = render(<Progress value={-10} />);
    expect(getFill(container).style.width).toBe("0%");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });

  it("treats undefined value as 0", () => {
    const { container } = render(<Progress value={undefined} />);
    expect(getFill(container).style.width).toBe("0%");
  });

  it("treats NaN value as 0", () => {
    const { container } = render(<Progress value={Number.NaN} />);
    expect(getFill(container).style.width).toBe("0%");
  });

  it("exposes progressbar accessibility role and value attributes", () => {
    const { container } = render(<Progress value={75} />);
    const progressbar = container.querySelector("[role='progressbar']");
    expect(progressbar).toBeDefined();
    expect(progressbar?.getAttribute("aria-valuenow")).toBe("75");
    expect(progressbar?.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar?.getAttribute("aria-valuemax")).toBe("100");
  });
});

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
