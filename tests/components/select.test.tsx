import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

afterEach(cleanup);

function renderSelect(value?: string) {
  return render(
    <Select value={value} onValueChange={() => {}}>
      <SelectTrigger aria-label="Choice">
        <SelectValue placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Alpha</SelectItem>
        <SelectItem value="b">Beta</SelectItem>
      </SelectContent>
    </Select>,
  );
}

describe("Select", () => {
  it("renders a labelled combobox trigger with placeholder and chevron", () => {
    const { container } = renderSelect();
    const trigger = screen.getByRole("combobox", { name: "Choice" });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.textContent).toContain("Pick one");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("shows the selected value in the trigger", () => {
    renderSelect("b");
    expect(screen.getByRole("combobox", { name: "Choice" }).textContent).toContain("Beta");
  });

  it("opens the listbox and reports the chosen option", async () => {
    // Radix Select drives on pointer capture; jsdom needs these shims.
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: vi.fn(() => false),
    });
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: vi.fn() });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    const onValueChange = vi.fn();
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger aria-label="Choice">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b">Beta</SelectItem>
        </SelectContent>
      </Select>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Choice" }));
    const option = await screen.findByRole("option", { name: "Beta" });
    await user.click(option);
    expect(onValueChange).toHaveBeenCalledWith("b");
  });
});
