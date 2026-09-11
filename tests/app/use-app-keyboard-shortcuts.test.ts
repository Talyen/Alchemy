import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ESCAPE_PRIORITY, pushEscapeHandler, resetEscapeStackForTests } from "@/app/escape-stack";
import { useAppKeyboardShortcuts } from "@/app/use-app-navigation";

afterEach(() => {
  cleanup();
  resetEscapeStackForTests();
});

describe("app Escape shortcuts", () => {
  it.each([true, false])("blocks navigation until the screen is interactive, with Back: %s", (hasBack) => {
    const onBack = vi.fn();
    const toggleGameMenu = vi.fn();
    const { rerender } = renderHook(
      ({ screenInteractive }) =>
        useAppKeyboardShortcuts({
          renderedScreen: "collection",
          screenInteractive,
          gameMenuOpen: false,
          onBack: hasBack ? onBack : undefined,
          toggleGameMenu,
        }),
      { initialProps: { screenInteractive: false } },
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onBack).not.toHaveBeenCalled();
    expect(toggleGameMenu).not.toHaveBeenCalled();

    rerender({ screenInteractive: true });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onBack).toHaveBeenCalledTimes(hasBack ? 1 : 0);
    expect(toggleGameMenu).toHaveBeenCalledTimes(hasBack ? 0 : 1);
  });

  it("keeps active dialogs and an existing menu dismissible while navigation is locked", () => {
    const onBack = vi.fn();
    const toggleGameMenu = vi.fn();
    const closeDialog = vi.fn();
    renderHook(() =>
      useAppKeyboardShortcuts({
        renderedScreen: "collection",
        screenInteractive: false,
        gameMenuOpen: true,
        onBack,
        toggleGameMenu,
      }),
    );
    const removeDialog = pushEscapeHandler({
      id: "test-dialog",
      priority: ESCAPE_PRIORITY.DIALOG,
      onEscape: closeDialog,
    });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(closeDialog).toHaveBeenCalledOnce();
    expect(toggleGameMenu).not.toHaveBeenCalled();
    removeDialog();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggleGameMenu).toHaveBeenCalledOnce();
    expect(onBack).not.toHaveBeenCalled();
  });
});
