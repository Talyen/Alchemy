import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Progress } from "@/components/ui/progress";

afterEach(cleanup);

describe("Progress", () => {
  function getFill(container: HTMLElement): HTMLElement {
    return container.firstChild!.firstChild as HTMLElement;
  }

  it("renders with default values", () => {
    const { container } = render(<Progress />);
    expect(container.firstChild!.firstChild).toBeDefined();
  });

  it("renders sm size", () => {
    const { container } = render(<Progress size="sm" />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("h-1");
  });

  it("sets width based on value", () => {
    const { container } = render(<Progress value={50} />);
    expect(getFill(container).style.width).toBe("50%");
  });

  it("clamps value above 100", () => {
    const { container } = render(<Progress value={150} />);
    expect(getFill(container).style.width).toBe("100%");
  });

  it("clamps value below 0", () => {
    const { container } = render(<Progress value={-10} />);
    expect(getFill(container).style.width).toBe("0%");
  });

  it("treats undefined value as 0", () => {
    const { container } = render(<Progress value={undefined} />);
    expect(getFill(container).style.width).toBe("0%");
  });

  it("treats NaN value as 0", () => {
    const { container } = render(<Progress value={Number.NaN} />);
    expect(getFill(container).style.width).toBe("0%");
  });

  it("applies custom color class", () => {
    const { container } = render(<Progress value={50} color="bg-blue-500" />);
    expect(getFill(container).className).toContain("bg-blue-500");
  });

  it("applies custom fill style", () => {
    const { container } = render(<Progress value={50} fillStyle={{ background: "red" }} />);
    const fill = getFill(container);
    expect(fill.style.background).toBe("red");
  });

  it("exposes progressbar accessibility role and value attributes", () => {
    const { container } = render(<Progress value={75} />);
    const progressbar = container.querySelector("[role='progressbar']");
    expect(progressbar).toBeDefined();
    expect(progressbar?.getAttribute("aria-valuenow")).toBe("75");
    expect(progressbar?.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar?.getAttribute("aria-valuemax")).toBe("100");
  });

  it("clamps aria-valuenow within 0 and 100", () => {
    const { container: low } = render(<Progress value={-20} />);
    expect(low.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe("0");

    cleanup();
    const { container: high } = render(<Progress value={140} />);
    expect(high.querySelector("[role='progressbar']")?.getAttribute("aria-valuenow")).toBe("100");
  });
});
