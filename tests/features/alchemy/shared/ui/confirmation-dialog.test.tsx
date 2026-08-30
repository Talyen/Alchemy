import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { ConfirmationDialog } from "@/features/alchemy/shared/ui/dialogs";

describe("ConfirmationDialog", () => {
  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
  });

  it("calls onCancel when Escape is pressed", () => {
    const onCancel = vi.fn();

    render(<ConfirmationDialog title="Delete item?" confirmLabel="Delete" onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not call onCancel on Escape when dismissOnEscape is false", () => {
    const onCancel = vi.fn();

    render(
      <ConfirmationDialog
        title="Delete item?"
        confirmLabel="Delete"
        dismissOnEscape={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("renders confirm and cancel actions", () => {
    const onConfirm = vi.fn();

    render(<ConfirmationDialog title="Delete item?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders optional body content below the description", () => {
    render(
      <ConfirmationDialog
        title="Salvage?"
        description="You will receive:"
        body={<div data-testid="dialog-body">preview</div>}
        confirmLabel="Salvage"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("You will receive:")).toBeTruthy();
    expect(screen.getByTestId("dialog-body").textContent).toBe("preview");
  });
});
