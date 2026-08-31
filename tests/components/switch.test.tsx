import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "@/components/ui/switch";

afterEach(cleanup);

describe("Switch", () => {
  it("renders with role switch and initial unchecked state", () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl).toBeDefined();
    expect(switchEl.getAttribute("aria-checked")).toBe("false");
    expect((switchEl as HTMLInputElement).checked).toBe(false);
  });

  it("renders with initial checked state", () => {
    render(<Switch checked={true} onCheckedChange={vi.fn()} />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl.getAttribute("aria-checked")).toBe("true");
    expect((switchEl as HTMLInputElement).checked).toBe(true);
  });

  it("calls onCheckedChange when clicked", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} />);
    const switchEl = screen.getByRole("switch");
    await userEvent.click(switchEl);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("does not fire when disabled", async () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} disabled onCheckedChange={onCheckedChange} />);
    const switchEl = screen.getByRole("switch");
    expect(switchEl.hasAttribute("disabled")).toBe(true);
    await userEvent.click(switchEl);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("applies custom className", () => {
    const { container } = render(<Switch checked={false} onCheckedChange={vi.fn()} className="custom-switch" />);
    expect((container.firstChild as HTMLElement)?.className).toContain("custom-switch");
  });
});
