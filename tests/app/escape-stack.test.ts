import { afterEach, describe, expect, it, vi } from "vitest";
import { ESCAPE_PRIORITY, pushEscapeHandler, resetEscapeStackForTests } from "@/app/escape-stack";

describe("escape-stack", () => {
  afterEach(() => {
    resetEscapeStackForTests();
  });

  it("dismisses one layer per Escape and promotes the next eligible layer", () => {
    const layers = [
      { id: "menu", priority: ESCAPE_PRIORITY.APP_MENU, onEscape: vi.fn() },
      { id: "screen", priority: ESCAPE_PRIORITY.SCREEN_OVERLAY, onEscape: vi.fn() },
      { id: "armory", priority: ESCAPE_PRIORITY.ARMORY_TRANSIENT, onEscape: vi.fn() },
      { id: "modal", priority: ESCAPE_PRIORITY.MODAL, onEscape: vi.fn() },
      { id: "dialog", priority: ESCAPE_PRIORITY.DIALOG, onEscape: vi.fn() },
      { id: "select", priority: ESCAPE_PRIORITY.SELECT, onEscape: vi.fn() },
    ];
    const remove = layers.map(pushEscapeHandler);
    for (let index = layers.length - 1; index >= 0; index--) {
      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(layers[index]!.onEscape).toHaveBeenCalledOnce();
      for (const lower of layers.slice(0, index)) expect(lower.onEscape).not.toHaveBeenCalled();
      remove[index]!();
    }
    const empty = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    window.dispatchEvent(empty);
    expect(empty.defaultPrevented).toBe(false);
    for (const layer of layers) expect(layer.onEscape).toHaveBeenCalledOnce();
  });

  it("keeps the latest equal-priority registration when an older registration cleans up", () => {
    const older = vi.fn();
    const newer = vi.fn();
    const removed = pushEscapeHandler({ id: "modal", priority: ESCAPE_PRIORITY.MODAL, onEscape: older });
    const replacement = pushEscapeHandler({ id: "modal", priority: ESCAPE_PRIORITY.MODAL, onEscape: newer });
    const top = pushEscapeHandler({ id: "other", priority: ESCAPE_PRIORITY.MODAL, onEscape: older });
    removed();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(older).toHaveBeenCalledOnce();
    expect(newer).not.toHaveBeenCalled();
    top();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(newer).toHaveBeenCalledOnce();
    replacement();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(newer).toHaveBeenCalledOnce();
    expect(older).toHaveBeenCalledOnce();
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

  it("skips a lower handler removed while processing the same Escape key", () => {
    const stale = vi.fn();
    const menu = vi.fn();
    const removeStale = pushEscapeHandler({ id: "stale", priority: ESCAPE_PRIORITY.MODAL, onEscape: stale });
    pushEscapeHandler({ id: "menu", priority: ESCAPE_PRIORITY.APP_MENU, onEscape: menu });
    pushEscapeHandler({
      id: "top",
      priority: ESCAPE_PRIORITY.DIALOG,
      onEscape: () => {
        removeStale();
        return false;
      },
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(stale).not.toHaveBeenCalled();
    expect(menu).toHaveBeenCalledTimes(1);
  });

  it("does not stopPropagation when every handler declines", () => {
    const menu = vi.fn(() => false);
    const documentHandler = vi.fn();

    pushEscapeHandler({ id: "menu", priority: ESCAPE_PRIORITY.APP_MENU, onEscape: menu });

    document.addEventListener("keydown", documentHandler, true);

    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });

    document.dispatchEvent(event);

    expect(menu).toHaveBeenCalledTimes(1);
    expect(documentHandler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);

    document.removeEventListener("keydown", documentHandler, true);
  });
});
