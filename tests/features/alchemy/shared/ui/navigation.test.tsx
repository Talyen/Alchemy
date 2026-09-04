import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FlankingPagination, HamburgerTrigger, PaginationControls } from "@/features/alchemy/shared/ui/navigation";

describe("PaginationControls", () => {
  afterEach(cleanup);

  it("returns null when totalPages is 1 and reserveSpace is false", () => {
    const { container } = render(
      <PaginationControls page={0} totalPages={1} onPageChange={vi.fn()} reserveSpace={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders container but no buttons when totalPages is 1 and reserveSpace is true", () => {
    const { container } = render(<PaginationControls page={0} totalPages={1} onPageChange={vi.fn()} reserveSpace />);
    expect(container.firstChild).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("navigates forward and backward when multiple pages exist", () => {
    const onPageChange = vi.fn();
    render(<PaginationControls page={1} totalPages={3} onPageChange={onPageChange} />);

    const prev = screen.getByRole("button", { name: "Previous page" });
    const next = screen.getByRole("button", { name: "Next page" });

    expect(prev).not.toHaveProperty("disabled", true);
    expect(next).not.toHaveProperty("disabled", true);

    fireEvent.click(prev);
    expect(onPageChange).toHaveBeenCalledWith(0);

    fireEvent.click(next);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables prev on first page and next on last page", () => {
    const { rerender } = render(<PaginationControls page={0} totalPages={2} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Next page" })).toHaveProperty("disabled", false);

    rerender(<PaginationControls page={1} totalPages={2} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Next page" })).toHaveProperty("disabled", true);
  });
});

describe("FlankingPagination", () => {
  afterEach(cleanup);

  it("hides pagination buttons when totalPages <= 1", () => {
    const { container } = render(
      <FlankingPagination page={0} totalPages={1} onPageChange={vi.fn()}>
        <div>Child content</div>
      </FlankingPagination>,
    );

    expect(screen.getByText("Child content")).toBeTruthy();
    const buttons = container.querySelectorAll("button");
    expect(buttons[0]?.className).toContain("invisible");
    expect(buttons[0]?.className).toContain("pointer-events-none");
    expect(buttons[1]?.className).toContain("invisible");
    expect(buttons[1]?.className).toContain("pointer-events-none");
  });

  it("triggers onPageChange when visible arrows are clicked", () => {
    const onPageChange = vi.fn();
    render(
      <FlankingPagination page={1} totalPages={3} onPageChange={onPageChange}>
        <div>Page 2</div>
      </FlankingPagination>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onPageChange).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe("HamburgerTrigger", () => {
  afterEach(cleanup);

  it("invokes onClick with bounding rect when clicked", () => {
    const onClick = vi.fn();
    render(<HamburgerTrigger onClick={onClick} label="Open game menu" />);

    const button = screen.getByRole("button", { name: "Open game menu" });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(expect.any(Object));
  });

  it("renders at the enlarged stage-corner size", () => {
    render(<HamburgerTrigger onClick={vi.fn()} label="Open game menu" />);

    const button = screen.getByRole("button", { name: "Open game menu" });
    expect(button.className).toMatch(/h-12/);
    expect(button.className).toMatch(/w-12/);
  });

  it("applies active styles when active is true", () => {
    const { rerender } = render(<HamburgerTrigger onClick={vi.fn()} label="Open game menu" active={false} />);
    const button = screen.getByRole("button", { name: "Open game menu" });
    expect(button.className).not.toMatch(/bg-muted\/40/);

    rerender(<HamburgerTrigger onClick={vi.fn()} label="Open game menu" active={true} />);
    expect(button.className).toMatch(/bg-muted\/40/);
    expect(button.className).toMatch(/text-foreground/);
  });
});
