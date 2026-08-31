import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

afterEach(cleanup);

describe("Select", () => {
  it("renders trigger with value", () => {
    render(
      <Select value="opt1">
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="opt1">Option 1</SelectItem>
          <SelectItem value="opt2">Option 2</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDefined();
    expect(trigger.textContent).toContain("Option 1");
  });

  it("renders placeholder when value is empty", () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Choose option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="opt1">Option 1</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger.textContent).toContain("Choose option");
  });

  it("applies custom trigger className", () => {
    const { container } = render(
      <Select value="opt1">
        <SelectTrigger className="my-select-trigger">
          <SelectValue />
        </SelectTrigger>
      </Select>,
    );

    const trigger = container.querySelector("button");
    expect(trigger?.className).toContain("my-select-trigger");
  });
});
