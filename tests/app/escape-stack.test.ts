// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ESCAPE_PRIORITY, pushEscapeHandler, resetEscapeStackForTests } from "@/app/escape-stack";

describe("escape-stack", () => {
  afterEach(() => {
    resetEscapeStackForTests();
  });

  it("runs the highest-priority handler and stops lower ones", () => {
    const dialog = vi.fn();
    const modal = vi.fn();
    const armory = vi.fn();
    const menu = vi.fn();

    pushEscapeHandler({ id: "menu", priority: ESCAPE_PRIORITY.APP_MENU, onEscape: menu });
    pushEscapeHandler({ id: "armory", priority: ESCAPE_PRIORITY.ARMORY_TRANSIENT, onEscape: armory });
    pushEscapeHandler({ id: "modal", priority: ESCAPE_PRIORITY.MODAL, onEscape: modal });
    pushEscapeHandler({ id: "dialog", priority: ESCAPE_PRIORITY.DIALOG, onEscape: dialog });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(dialog).toHaveBeenCalledTimes(1);
    expect(modal).not.toHaveBeenCalled();
    expect(armory).not.toHaveBeenCalled();
    expect(menu).not.toHaveBeenCalled();
  });

  it("runs a screen overlay before the app menu", () => {
    const overlay = vi.fn();
    const menu = vi.fn();

    pushEscapeHandler({ id: "menu", priority: ESCAPE_PRIORITY.APP_MENU, onEscape: menu });
    pushEscapeHandler({ id: "overlay", priority: ESCAPE_PRIORITY.SCREEN_OVERLAY, onEscape: overlay });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(overlay).toHaveBeenCalledTimes(1);
    expect(menu).not.toHaveBeenCalled();
  });

  it("falls through to armory-transient before app-menu", () => {
    const armory = vi.fn();
    const menu = vi.fn();

    pushEscapeHandler({ id: "menu", priority: ESCAPE_PRIORITY.APP_MENU, onEscape: menu });
    pushEscapeHandler({ id: "armory", priority: ESCAPE_PRIORITY.ARMORY_TRANSIENT, onEscape: armory });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(armory).toHaveBeenCalledTimes(1);
    expect(menu).not.toHaveBeenCalled();
  });

  it("unsubscribing a handler promotes the next priority", () => {
    const modal = vi.fn();
    const menu = vi.fn();

    const unsubscribeModal = pushEscapeHandler({
      id: "modal",
      priority: ESCAPE_PRIORITY.MODAL,
      onEscape: modal,
    });
    pushEscapeHandler({ id: "menu", priority: ESCAPE_PRIORITY.APP_MENU, onEscape: menu });

    unsubscribeModal();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(modal).not.toHaveBeenCalled();
    expect(menu).toHaveBeenCalledTimes(1);
  });

  it("falls through when the top handler declines", () => {
    const modal = vi.fn(() => false);
    const menu = vi.fn();

    pushEscapeHandler({ id: "modal", priority: ESCAPE_PRIORITY.MODAL, onEscape: modal });
    pushEscapeHandler({ id: "menu", priority: ESCAPE_PRIORITY.APP_MENU, onEscape: menu });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(modal).toHaveBeenCalledTimes(1);
    expect(menu).toHaveBeenCalledTimes(1);
  });

  it("does not stopPropagation when every handler declines", () => {
    const menu = vi.fn(() => false);
    const documentHandler = vi.fn();

    pushEscapeHandler({ id: "menu", priority: ESCAPE_PRIORITY.APP_MENU, onEscape: menu });
    // Document capture runs after window capture when the event is not stopped.
    document.addEventListener("keydown", documentHandler, true);

    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    // Dispatch on document so both window-capture (stack) and document-capture run.
    document.dispatchEvent(event);

    expect(menu).toHaveBeenCalledTimes(1);
    expect(documentHandler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);

    document.removeEventListener("keydown", documentHandler, true);
  });
});
