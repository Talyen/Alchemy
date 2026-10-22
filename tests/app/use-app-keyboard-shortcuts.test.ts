import { createCleanup } from "@/lib/cleanup";
import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ESCAPE_PRIORITY, pushEscapeHandler, resetEscapeStackForTests } from "@/app/escape-stack";
import { useAppKeyboardShortcuts } from "@/app/use-app-keyboard-shortcuts";
import * as focusNav from "@/features/alchemy/shared/ui/dialogs/focus-navigation";

afterEach(() => {
  cleanup();
  resetEscapeStackForTests();
});

describe("app Escape shortcuts", () => {
  it.each([{ isComposing: true }, { keyCode: 229 }])(
    "leaves composition keys with the text editor: %j",
    (composition) => {
      const focusSpy = vi.spyOn(focusNav, "focusInDirection").mockReturnValue(true);
      const previousSpy = vi.spyOn(focusNav, "focusPreviousControl").mockImplementation(() => {});
      const onBack = vi.fn();
      const toggleGameMenu = vi.fn();
      renderHook(() =>
        useAppKeyboardShortcuts({
          renderedScreen: "armory",
          screenInteractive: true,
          gameMenuOpen: false,
          onBack,
          toggleGameMenu,
        }),
      );
      for (const key of ["ArrowDown", "F7", "Escape"]) {
        expect(fireEvent.keyDown(document, { key, ...composition })).toBe(true);
      }
      expect(focusSpy).not.toHaveBeenCalled();
      expect(previousSpy).not.toHaveBeenCalled();
      expect(onBack).not.toHaveBeenCalled();
      expect(toggleGameMenu).not.toHaveBeenCalled();
    },
  );

  it("keeps Steam Input backward focus inside an open Options selector", () => {
    const previous = vi.spyOn(focusNav, "focusPreviousControl").mockImplementation(() => {});
    renderHook(() =>
      useAppKeyboardShortcuts({
        renderedScreen: "options",
        screenInteractive: true,
        gameMenuOpen: false,
        toggleGameMenu: vi.fn(),
      }),
    );
    const listbox = document.createElement("div");
    listbox.setAttribute("role", "listbox");
    listbox.setAttribute("data-state", "open");
    document.body.append(listbox);
    using _scopeCleanup = createCleanup(() => listbox.remove());

    fireEvent.keyDown(listbox, { key: "F7" });
    expect(previous).not.toHaveBeenCalled();
  });

  it("activates Options switches and inventory checkboxes with the Steam Input confirm key", () => {
    renderHook(() =>
      useAppKeyboardShortcuts({
        renderedScreen: "options",
        screenInteractive: true,
        gameMenuOpen: false,
        toggleGameMenu: vi.fn(),
      }),
    );
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    document.body.append(checkbox);
    expect(fireEvent.keyDown(checkbox, { key: "Enter" })).toBe(false);
    expect(checkbox.checked).toBe(true);
    fireEvent.keyDown(checkbox, { key: "Enter", repeat: true });
    expect(checkbox.checked).toBe(true);
    checkbox.disabled = true;
    fireEvent.keyDown(checkbox, { key: "Enter" });
    expect(checkbox.checked).toBe(true);
    checkbox.remove();
  });

  it("triggers focusPreviousControl on F7 and ignores repeated keydown events", () => {
    const focusSpy = vi.spyOn(focusNav, "focusPreviousControl").mockImplementation(() => {});
    renderHook(() =>
      useAppKeyboardShortcuts({
        renderedScreen: "options",
        screenInteractive: true,
        gameMenuOpen: false,
        toggleGameMenu: vi.fn(),
      }),
    );

    const event = fireEvent.keyDown(document, { key: "F7" });
    expect(event).toBe(false);
    expect(focusSpy).toHaveBeenCalledOnce();

    fireEvent.keyDown(document, { key: "F7", repeat: true });
    expect(focusSpy).toHaveBeenCalledOnce();
  });

  it("navigates directionally on arrow keys and respects Radix open target suppression", () => {
    const focusSpy = vi.spyOn(focusNav, "focusInDirection").mockReturnValue(true);
    renderHook(() =>
      useAppKeyboardShortcuts({
        renderedScreen: "options",
        screenInteractive: true,
        gameMenuOpen: false,
        toggleGameMenu: vi.fn(),
      }),
    );

    const event = fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(event).toBe(false);
    expect(focusSpy).toHaveBeenCalledWith("right");

    focusSpy.mockClear();

    // Radix open target suppresses directional navigation
    const openSelect = document.createElement("div");
    openSelect.setAttribute("data-radix-select-content", "");
    openSelect.setAttribute("data-state", "open");
    document.body.append(openSelect);

    const suppressedEvent = fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(suppressedEvent).toBe(true);
    expect(focusSpy).not.toHaveBeenCalled();

    openSelect.remove();
  });
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
