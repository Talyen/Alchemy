// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmationDialog } from "@/features/alchemy/shared/ui/dialogs";

describe("ConfirmationDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onCancel when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<ConfirmationDialog title="Delete item?" confirmLabel="Delete" onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not call onCancel on Escape when dismissOnEscape is false", async () => {
    const user = userEvent.setup();
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

    await user.keyboard("{Escape}");

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("renders confirm and cancel actions", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<ConfirmationDialog title="Delete item?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
