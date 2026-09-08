import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "@/components/ui/switch";

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
