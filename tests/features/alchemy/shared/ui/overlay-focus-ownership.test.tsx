import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogFocus } from "@/features/alchemy/shared/ui/use-dialog-focus";
import { ConfirmationDialog } from "@/features/alchemy/shared/ui/dialogs";
import { MOTION_FADE_MS } from "@/lib/game-constants";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { focusPreviousControl } from "@/features/alchemy/shared/ui/focus-navigation";

function Dialog({
  name,
  replacement = false,
  hidden = false,
}: {
  name: string;
  replacement?: boolean;
  hidden?: boolean;
}) {
  const { panelRef, handleKeyDown } = useDialogFocus();
  return (
    <div ref={panelRef} role="dialog" aria-label={name} tabIndex={-1} onKeyDown={handleKeyDown} hidden={hidden}>
      <button key={replacement ? "replacement" : "first"}>
        {name} first{replacement ? " replacement" : ""}
      </button>
      <button>{name} last</button>
    </div>
  );
}

const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    new DOMRect(0, 0, 100, 30),
  ] as unknown as DOMRectList);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  resetEscapeStackForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (scrollIntoViewDescriptor)
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});
async function settle() {
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(20);
  });
}

describe("overlay focus ownership", () => {
  it("restores the opener when a dialog closes before its first ownership frame", async () => {
    const content = (open: boolean) => (
      <>
        <button>View Deck</button>
        {open && <Dialog name="Deck" />}
      </>
    );
    const view = render(content(false));
    const opener = screen.getByRole("button", { name: "View Deck" });
    opener.focus();
    view.rerender(content(true));
    // Native inert content drops focus before the first animation frame.
    opener.blur();
    view.rerender(content(false));
    await settle();
    expect(document.activeElement).toBe(opener);
  });

  it("keeps controller traversal in the most recently opened panel even when it is earlier in DOM order", async () => {
    const content = (front: boolean) => (
      <>
        {front && <Dialog name="Menu" />}
        <Dialog name="Wish" />
      </>
    );
    const view = render(content(false));
    await settle();
    view.rerender(content(true));
    await settle();
    const first = screen.getByRole("button", { name: "Menu first" });
    first.focus();
    focusPreviousControl();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Menu last" }));
  });

  it("recovers keyboard focus when a changing choice removes the focused control", async () => {
    const view = render(<Dialog name="Wish" />);
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Wish first" }));
    view.rerender(<Dialog name="Wish" replacement />);
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Wish first replacement" }));
  });

  it("does not reset the foreground selection when a covered panel unmounts", async () => {
    const content = (covered: boolean, front: boolean) => (
      <>
        <button>Inspect cards</button>
        {covered && <Dialog name="Wish" />}
        {front && <Dialog name="Menu" />}
      </>
    );
    const view = render(content(false, false));
    screen.getByRole("button", { name: "Inspect cards" }).focus();
    view.rerender(content(true, false));
    await settle();
    view.rerender(content(true, true));
    await settle();
    const last = screen.getByRole("button", { name: "Menu last" });
    last.focus();
    view.rerender(content(false, true));
    await settle();
    expect(document.activeElement).toBe(last);
  });

  it("suspends a hidden panel's trap and restores the underlying choice", async () => {
    const content = (front: boolean, hidden = false) => (
      <>
        <Dialog name="Wish" />
        {front && <Dialog name="Menu" hidden={hidden} />}
      </>
    );
    const view = render(content(false));
    await settle();
    const last = screen.getByRole("button", { name: "Wish last" });
    last.focus();
    view.rerender(content(true));
    await settle();
    view.rerender(content(true, true));
    await settle();
    expect(document.activeElement).toBe(last);
  });

  it("restores the opener after it remains inert beyond the first recovery frame", async () => {
    const content = (dialog: boolean, inert: boolean) => (
      <>
        <div data-screen-content inert={inert}>
          <button>End Turn</button>
        </div>
        {dialog && <Dialog name="Confirm" />}
      </>
    );
    const view = render(content(false, false));
    const opener = screen.getByRole("button", { name: "End Turn" });
    opener.focus();
    view.rerender(content(true, true));
    await settle();
    view.rerender(content(false, true));
    await settle();
    await settle();
    view.rerender(content(false, false));
    await settle();
    expect(document.activeElement).toBe(opener);
  });

  it("waits for the replacement screen when a departed opener no longer exists", async () => {
    const content = (stage: "open" | "dialog" | "preparing" | "ready") => (
      <>
        <div data-screen-content inert={stage === "dialog" || stage === "preparing"}>
          {stage === "open" || stage === "dialog" ? (
            <button key="opener">Inspect cards</button>
          ) : (
            <button key="replacement">Continue journey</button>
          )}
        </div>
        {stage === "dialog" && <Dialog name="Confirm" />}
      </>
    );
    const view = render(content("open"));
    screen.getByRole("button", { name: "Inspect cards" }).focus();
    view.rerender(content("dialog"));
    await settle();
    view.rerender(content("preparing"));
    await settle();
    await settle();
    view.rerender(content("ready"));
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue journey" }));
  });

  it("retains the departing owner through the inert exit fade before restoring its opener", async () => {
    const content = (open: boolean) => (
      <>
        <button>Inspect cards</button>
        <ConfirmationDialog
          open={open}
          title="Confirm"
          confirmLabel="Confirm"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </>
    );
    const view = render(content(false));
    const opener = screen.getByRole("button", { name: "Inspect cards" });
    opener.focus();
    view.rerender(content(true));
    await settle();
    await settle();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    view.rerender(content(false));
    await settle();
    await settle();
    await act(async () => {
      vi.advanceTimersByTime(MOTION_FADE_MS);
    });
    expect(document.activeElement).toBe(opener);
  });

  it.each(["pointer", "focus"])("cancels deferred restoration after fresh %s input", async (input) => {
    const content = (dialog: boolean, inert: boolean) => (
      <>
        <div data-screen-content inert={inert}>
          <button>End Turn</button>
        </div>
        <button>Inspect enemy</button>
        {dialog && <Dialog name="Confirm" />}
      </>
    );
    const view = render(content(false, false));
    screen.getByRole("button", { name: "End Turn" }).focus();
    view.rerender(content(true, true));
    await settle();
    view.rerender(content(false, true));
    await settle();
    const alternative = screen.getByRole("button", { name: "Inspect enemy" });
    if (input === "pointer") document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    else alternative.focus();
    view.rerender(content(false, false));
    await settle();
    expect(document.activeElement).toBe(input === "pointer" ? document.body : alternative);
  });
});
