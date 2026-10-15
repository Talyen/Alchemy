import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useDialogFocus } from "@/features/alchemy/shared/ui/use-dialog-focus";

function Dialog({
  disabled = false,
  replacement = false,
  empty = false,
}: {
  disabled?: boolean;
  replacement?: boolean;
  empty?: boolean;
}) {
  const { panelRef, handleKeyDown } = useDialogFocus();
  return (
    <div role="dialog" tabIndex={-1} ref={panelRef} onKeyDown={handleKeyDown}>
      {!empty && (
        <>
          {!replacement && (
            <button data-dialog-initial-focus disabled={disabled}>
              Preferred
            </button>
          )}
          <button>Continue</button>
        </>
      )}
    </div>
  );
}

const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

beforeEach(() => {
  vi.useFakeTimers();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    { width: 30, height: 20 },
  ] as unknown as DOMRectList);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (scrollIntoViewDescriptor)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("dialog focus regressions", () => {
  it("restores an unfocused page without selecting its first control", () => {
    const view = render(
      <div data-screen-content>
        <button>Inspect enemy</button>
      </div>,
    );
    expect(document.activeElement).toBe(document.body);
    view.rerender(
      <div data-screen-content>
        <button>Inspect enemy</button>
        <Dialog />
      </div>,
    );
    vi.runOnlyPendingTimers();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Preferred" }));
    view.rerender(
      <div data-screen-content>
        <button>Inspect enemy</button>
      </div>,
    );
    vi.runOnlyPendingTimers();
    expect(document.activeElement).toBe(document.body);
  });

  it("retries the original control after its screen stops being inert", () => {
    const content = (dialog: boolean, inert: boolean) => (
      <>
        <div data-screen-content inert={inert}>
          <button>Inspect enemy</button>
          <button>End Turn</button>
        </div>
        {dialog && <Dialog />}
      </>
    );
    const view = render(content(false, false));
    const opener = screen.getByRole("button", { name: "End Turn" });
    opener.focus();
    view.rerender(content(true, true));
    vi.runOnlyPendingTimers();
    view.rerender(content(false, true));
    view.rerender(content(false, false));
    vi.runOnlyPendingTimers();
    expect(document.activeElement).toBe(opener);
  });

  it("waits for prepared controls instead of leaving initial focus on the dialog", () => {
    const rects = document.body.getClientRects();
    let controlsReady = false;
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (this: HTMLElement) {
      return this.tagName === "BUTTON" && !controlsReady ? ([] as unknown as DOMRectList) : rects;
    });
    render(<Dialog />);
    vi.runOnlyPendingTimers();
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
    controlsReady = true;
    vi.runOnlyPendingTimers();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Preferred" }));
  });

  it("focuses an enabled control when the preferred initial action is disabled", () => {
    render(<Dialog disabled />);
    vi.runOnlyPendingTimers();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
  });
  it("contains focus after the initial action is replaced", () => {
    const view = render(<Dialog />);
    vi.runOnlyPendingTimers();
    view.rerender(<Dialog replacement />);
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
    outside.remove();
  });
  it("traps both Tab directions while a dialog temporarily has no controls", () => {
    render(<Dialog empty />);
    const panel = screen.getByRole("dialog");
    panel.focus();
    for (const shiftKey of [false, true]) {
      expect(fireEvent.keyDown(panel, { key: "Tab", shiftKey })).toBe(false);
      expect(document.activeElement).toBe(panel);
    }
  });
});
