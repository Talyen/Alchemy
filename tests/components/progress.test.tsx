import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { Progress } from "@/components/ui/progress";

afterEach(cleanup);

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
