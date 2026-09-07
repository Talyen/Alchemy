import userEvent from "@testing-library/user-event";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { ConfirmationDialog } from "@/features/alchemy/shared/ui/dialogs";
import { MOTION_FADE_MS } from "@/lib/game-constants";

describe("ConfirmationDialog", () => {
  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
    vi.useRealTimers();
  });

  it("starts on Cancel and keeps keyboard navigation within the dialog", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Outside</button>
        <ConfirmationDialog title="Salvage" confirmLabel="Salvage" onConfirm={vi.fn()} onCancel={vi.fn()} />
      </>,
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Salvage" });
    expect(document.activeElement).toBe(cancel);
    await user.tab();
    expect(document.activeElement).toBe(confirm);
    await user.tab();
    expect(document.activeElement).toBe(cancel);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(confirm);
    screen.getByRole("button", { name: "Outside" }).focus();
    expect(document.activeElement).toBe(cancel);
  });

  it("calls onCancel when Escape is pressed", () => {
    const onCancel = vi.fn();

    render(<ConfirmationDialog title="Delete item?" confirmLabel="Delete" onConfirm={vi.fn()} onCancel={onCancel} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])("restores focus after exit with explicit target: %s", (explicitTarget) => {
    vi.useFakeTimers();
    const returnFocusRef = createRef<HTMLButtonElement>();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const dialog = (open: boolean) => (
      <>
        <button type="button" ref={returnFocusRef}>
          Return target
        </button>
        <button type="button">Opener</button>
        <ConfirmationDialog
          open={open}
          title="Salvage"
          confirmLabel="Salvage"
          onConfirm={onConfirm}
          onCancel={onCancel}
          returnFocusRef={explicitTarget ? returnFocusRef : undefined}
        />
      </>
    );
    const { rerender } = render(dialog(false));
    const opener = screen.getByRole("button", { name: "Opener" });
    opener.focus();
    rerender(dialog(true));
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const focusCancel = vi.spyOn(cancel, "focus");
    expect(document.activeElement).toBe(cancel);
    rerender(dialog(false));
    expect((cancel as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Salvage" }));
    fireEvent.click(cancel);
    opener.focus();
    expect(focusCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(explicitTarget ? returnFocusRef.current : opener);
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
