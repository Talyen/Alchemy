import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { FlankingPagination, PaginationControls } from "@/features/alchemy/shared/ui/navigation";

afterEach(cleanup);

it.each([false, true])("dispatches page changes and blocks boundary activation (flanking: %s)", async (flanking) => {
  const onPageChange = vi.fn();
  const controls = (page: number, totalPages = 3) =>
    flanking ? (
      <FlankingPagination page={page} totalPages={totalPages} onPageChange={onPageChange}>
        Content
      </FlankingPagination>
    ) : (
      <PaginationControls page={page} totalPages={totalPages} onPageChange={onPageChange} />
    );
  const { rerender } = render(controls(0));
  const previous = screen.getByRole("button", { name: "Previous page" });
  const next = screen.getByRole("button", { name: "Next page" });
  fireEvent.click(previous);
  expect(onPageChange).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.tab();
  expect(document.activeElement).toBe(next);
  await user.keyboard("{Enter}");
  expect(onPageChange.mock.calls).toEqual([[1]]);
  rerender(controls(2));
  fireEvent.click(next);
  fireEvent.click(previous);
  expect(onPageChange.mock.calls).toEqual([[1], [1]]);
  rerender(controls(0, 1));
  expect(screen.queryByRole("button")).toBeNull();
  for (const button of document.querySelectorAll("button")) {
    expect(button.disabled).toBe(true);
    expect(button.tabIndex).toBe(-1);
    fireEvent.click(button);
  }
  expect(onPageChange).toHaveBeenCalledTimes(2);
});
