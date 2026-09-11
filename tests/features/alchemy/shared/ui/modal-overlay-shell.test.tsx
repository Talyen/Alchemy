import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushEscapeHandler, resetEscapeStackForTests } from "@/app/escape-stack";
import { ModalOverlayShell } from "@/features/alchemy/shared/ui/modal-overlay-shell";
import { setModalRoot } from "@/features/alchemy/shared/ui/modal-root";
import { MOTION_FADE_MS } from "@/lib/game-constants";

beforeEach(() => vi.useFakeTimers());

async function paint() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    vi.advanceTimersByTime(20);
  });
}

afterEach(() => {
  cleanup();
  setModalRoot(null);
  resetEscapeStackForTests();
  vi.useRealTimers();
});

describe("ModalOverlayShell", () => {
  it("escapes nested layout and dismisses only direct backdrop clicks", async () => {
    const onClose = vi.fn();
    const onUnderlyingClick = vi.fn();
    const root = document.createElement("div");
    document.body.append(root);
    setModalRoot(root);
    const { unmount } = render(
      <div onClick={onUnderlyingClick}>
        <ModalOverlayShell open escapeId="portal" onClose={onClose} dismissOnBackdrop testId="overlay">
          <button type="button">Content</button>
        </ModalOverlayShell>
      </div>,
    );
    const overlay = screen.getByTestId("overlay");
    expect(overlay.parentElement).toBe(root);
    await paint();
    fireEvent.click(screen.getByRole("button", { name: "Content" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(overlay.querySelector("[data-modal-content]")!);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onUnderlyingClick).not.toHaveBeenCalled();
    unmount();
    root.remove();
  });

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

  it("retains visuals without actions during exit and cancels removal on reopen", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const onAction = vi.fn();
    const onKeyDown = vi.fn();
    const overlay = (open: boolean) => (
      <ModalOverlayShell
        open={open}
        escapeId="test"
        onClose={onClose}
        dismissOnBackdrop
        testId="overlay"
        className={open ? "grid-cols-4" : "grid-cols-1"}
      >
        <button type="button" onClick={onAction} onKeyDown={onKeyDown}>
          {open ? "Action" : "Reset"}
        </button>
      </ModalOverlayShell>
    );
    const { rerender } = render(overlay(true));
    await paint();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    onClose.mockClear();

    rerender(overlay(false));
    const exiting = screen.getByTestId("overlay");
    expect(exiting.hasAttribute("inert")).toBe(true);
    expect(screen.queryByText("Reset")).toBeNull();
    expect(exiting.querySelector("[data-modal-content]")?.className).toContain("grid-cols-4");
    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(fireEvent.keyDown(screen.getByRole("button"), { key: "Tab" })).toBe(true);
    fireEvent.click(exiting);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(MOTION_FADE_MS / 2));
    rerender(overlay(true));
    await paint();
    act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
    expect(screen.getByTestId("overlay").hasAttribute("inert")).toBe(false);
    fireEvent.click(screen.getByRole("button"));
    expect(onAction).toHaveBeenCalledTimes(2);

    rerender(overlay(false));
    act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
    expect(screen.queryByTestId("overlay")).toBeNull();
  });

  it("keeps late artwork hidden after closing and isolates the next opening", async () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    const overlay = (open: boolean) => (
      <ModalOverlayShell open={open} escapeId="pending" onClose={onClose} dismissOnBackdrop testId="overlay">
        <button onClick={onAction}>
          <img src="art.webp" alt="Artwork" />
        </button>
      </ModalOverlayShell>
    );
    const { rerender } = render(overlay(true));
    const first = screen.getByAltText("Artwork");
    let resolveOld!: () => void;
    Object.defineProperty(first, "decode", {
      value: () =>
        new Promise<void>((resolve) => {
          resolveOld = resolve;
        }),
    });
    fireEvent.load(first);
    fireEvent.click(screen.getByRole("button"));
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("overlay"));
    expect(onClose).toHaveBeenCalledOnce();
    rerender(overlay(false));
    await act(async () => resolveOld());
    await paint();
    expect(screen.getByTestId("overlay").querySelector("[data-artwork-pending]")).not.toBeNull();
    rerender(overlay(true));
    const replacement = screen.getByAltText("Artwork");
    expect(replacement).not.toBe(first);
    await paint();
    expect(screen.getByTestId("overlay").querySelector("[data-artwork-pending]")).not.toBeNull();
    fireEvent.error(replacement);
    await paint();
    expect(screen.getByTestId("overlay").querySelector("[data-artwork-pending]")).toBeNull();
    expect(replacement.style.visibility).toBe("hidden");
    fireEvent.click(screen.getByRole("button"));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
