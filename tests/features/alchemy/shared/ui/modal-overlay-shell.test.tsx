import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pushEscapeHandler, resetEscapeStackForTests } from "@/app/escape-stack";
import { ModalOverlayShell } from "@/features/alchemy/shared/ui/modal-overlay-shell";
import { MOTION_FADE_MS } from "@/lib/game-constants";

afterEach(() => {
  cleanup();
  resetEscapeStackForTests();
  vi.useRealTimers();
});

describe("ModalOverlayShell", () => {
  it("only handles Escape while open and rendered", () => {
    const onClose = vi.fn();
    const underlying = vi.fn();
    pushEscapeHandler({ id: "underlying", priority: 0, onEscape: underlying });
    const overlay = (open: boolean, mount: boolean) => (
      <ModalOverlayShell open={open} mount={mount} escapeId="test" onClose={onClose} testId="overlay">
        Content
      </ModalOverlayShell>
    );
    const { rerender } = render(overlay(false, true));
    expect(screen.queryByTestId("overlay")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    rerender(overlay(true, false));
    expect(screen.queryByTestId("overlay")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(underlying).toHaveBeenCalledTimes(2);

    rerender(overlay(true, true));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(overlay(true, false));
    expect(screen.queryByTestId("overlay")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(underlying).toHaveBeenCalledTimes(3);

    rerender(overlay(true, true));
    rerender(overlay(false, true));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(underlying).toHaveBeenCalledTimes(4);
  });

  it("retains visuals without actions during exit and cancels removal on reopen", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onAction = vi.fn();
    const onKeyDown = vi.fn();
    const overlay = (open: boolean) => (
      <ModalOverlayShell open={open} escapeId="test" onClose={onClose} dismissOnBackdrop testId="overlay">
        <button type="button" onClick={onAction} onKeyDown={onKeyDown}>
          Action
        </button>
      </ModalOverlayShell>
    );
    const { rerender } = render(overlay(true));
    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    onClose.mockClear();

    rerender(overlay(false));
    const exiting = screen.getByTestId("overlay");
    expect(exiting.hasAttribute("inert")).toBe(true);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    fireEvent.click(exiting);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(MOTION_FADE_MS / 2));
    rerender(overlay(true));
    act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
    expect(screen.getByTestId("overlay").hasAttribute("inert")).toBe(false);
    fireEvent.click(screen.getByRole("button"));
    expect(onAction).toHaveBeenCalledTimes(2);

    rerender(overlay(false));
    act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
    expect(screen.queryByTestId("overlay")).toBeNull();
  });
});
