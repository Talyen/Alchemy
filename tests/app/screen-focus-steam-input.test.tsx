import { useAppKeyboardShortcuts } from "@/app/use-app-keyboard-shortcuts";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useScreenFocus } from "@/app/use-screen-focus";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["bumper", "Alt+Tab", "blur", "blur after ready", "Escape", "pointer", "wheel", "Enter", " "])(
  "handles %s during screen preparation without unintended focus",
  (input) => {
    const frames = new Map<number, FrameRequestCallback>();
    let id = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (frame: number) => frames.delete(frame));
    function PreparingScreen({ ready }: { ready: boolean }) {
      useScreenFocus("collection", ready);
      return <div data-screen-content>{ready ? <button>Back</button> : null}</div>;
    }
    const { rerender } = render(<PreparingScreen ready={false} />);
    fireEvent.keyDown(window, { key: "F7" });
    if (["Escape", "Enter", " "].includes(input)) {
      if (input !== "Escape") fireEvent.pointerDown(document.body);
      fireEvent.keyDown(window, { key: input });
    }
    if (input === "pointer") fireEvent.pointerDown(document.body);
    if (input === "wheel") fireEvent.wheel(document.body);
    if (input === "Alt+Tab") fireEvent.keyDown(window, { key: "Tab", altKey: true });
    if (input === "blur") {
      fireEvent.blur(window);
      fireEvent.focus(window);
    }
    rerender(<PreparingScreen ready />);
    if (input === "blur after ready") {
      fireEvent.blur(window);
      fireEvent.focus(window);
    }
    const back = screen.getByRole("button", { name: "Back" });
    vi.spyOn(back, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    back.scrollIntoView = vi.fn();
    act(() => {
      for (const frame of frames.values()) frame(16);
    });
    expect(document.activeElement).toBe(input === "bumper" ? back : document.body);
  },
);

it("preserves held text-entry keys while blocking repeated button confirmation", () => {
  function SearchScreen() {
    useScreenFocus("armory", true);
    return (
      <>
        <input type="search" aria-label="Search inventory" />
        <button>Search</button>
      </>
    );
  }
  render(<SearchScreen />);
  const input = screen.getByRole("searchbox", { name: "Search inventory" });
  input.focus();
  expect(fireEvent.keyDown(input, { key: " ", repeat: true })).toBe(true);
  const button = screen.getByRole("button", { name: "Search" });
  button.focus();
  expect(fireEvent.keyDown(button, { key: " ", repeat: true })).toBe(false);
  expect(fireEvent.keyDown(button, { key: "Enter", repeat: true })).toBe(false);
});

it.each([{ altKey: true }, { altKey: true, shiftKey: true }, { metaKey: true }])(
  "keeps window-switching Tab away from controls and dialog handlers: %j",
  (modifiers) => {
    const onKeyDown = vi.fn();
    const activate = vi.fn();
    function Screen() {
      useScreenFocus("collection", true);
      return (
        <button onKeyDown={onKeyDown} onClick={activate}>
          Back
        </button>
      );
    }
    render(<Screen />);
    const back = screen.getByRole("button", { name: "Back" });
    back.focus();
    expect(fireEvent.keyDown(back, { key: "Tab", ...modifiers })).toBe(false);
    fireEvent.blur(window);
    fireEvent.focus(window);
    expect(document.activeElement).toBe(back);
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  },
);

it("does not turn text editing or dropdown arrows into focus navigation", () => {
  function EditingScreen() {
    useScreenFocus("options", true);
    return (
      <>
        <input aria-label="Search" />
        <select aria-label="Language">
          <option>English</option>
        </select>
      </>
    );
  }
  render(<EditingScreen />);
  for (const control of [screen.getByRole("textbox"), screen.getByRole("combobox")]) {
    control.focus();
    fireEvent.keyDown(control, { key: "ArrowDown" });
    expect(document.documentElement.dataset.focusNavigation).toBe("false");
  }
  fireEvent.keyDown(window, { key: "Tab", isComposing: true });
  expect(document.documentElement.dataset.focusNavigation).toBe("false");
  fireEvent.keyDown(window, { key: "Tab" });
  expect(document.documentElement.dataset.focusNavigation).toBe("true");
});

it.each(["Escape", "pointer", "blur"])("does not restart navigation from held keys after %s", (input) => {
  function NavigationScreen() {
    useScreenFocus("collection", true);
    useAppKeyboardShortcuts({
      renderedScreen: "collection",
      screenInteractive: true,
      gameMenuOpen: false,
      toggleGameMenu: () => {},
    });
    return (
      <div data-screen-content>
        <button>Back</button>
      </div>
    );
  }
  render(<NavigationScreen />);
  const back = screen.getByRole("button", { name: "Back" });
  vi.spyOn(back, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  back.scrollIntoView = vi.fn();
  fireEvent.keyDown(document.body, { key: "Tab" });
  if (input === "Escape") fireEvent.keyDown(document.body, { key: "Escape" });
  else if (input === "pointer") fireEvent.pointerDown(document.body);
  else fireEvent.blur(window);
  for (const key of ["Tab", "F7", "ArrowRight"]) {
    expect(fireEvent.keyDown(document.body, { key, repeat: true })).toBe(false);
    expect(document.activeElement).toBe(document.body);
    expect(document.documentElement.dataset.focusNavigation).toBe("false");
  }
  fireEvent.keyDown(document.body, { key: "ArrowRight" });
  expect(document.activeElement).toBe(back);
});
