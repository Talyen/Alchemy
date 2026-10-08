import { afterEach, describe, expect, it, vi } from "vitest";
import { focusInDirection, focusPreviousControl } from "@/features/alchemy/shared/ui/focus-navigation";

function place(element: HTMLElement, x: number, y: number) {
  const rect = { left: x, right: x + 50, top: y, bottom: y + 30, width: 50, height: 30, x, y, toJSON: () => ({}) };
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect);
  vi.spyOn(element, "getClientRects").mockReturnValue([rect] as unknown as DOMRectList);
  element.scrollIntoView = vi.fn();
}
function screen() {
  const root = document.createElement("div");
  root.dataset.screenContent = "";
  document.body.append(root);
  return root;
}
function button(root: HTMLElement, x: number, y: number) {
  const item = document.createElement("button");
  root.append(item);
  place(item, x, y);
  return item;
}
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("directional focus", () => {
  it("lets directional navigation leave inventory filter checkboxes", () => {
    const root = screen();
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    root.append(checkbox);
    place(checkbox, 0, 0);
    const right = button(root, 100, 0);
    const below = button(root, 0, 100);
    checkbox.focus();
    expect(focusInDirection("right")).toBe(true);
    expect(document.activeElement).toBe(right);
    checkbox.focus();
    focusInDirection("down");
    expect(document.activeElement).toBe(below);
    expect(checkbox.checked).toBe(true);
  });
  it("follows a grid in both axes and stops at the edge", () => {
    const root = screen();
    const first = button(root, 0, 0),
      right = button(root, 100, 0),
      below = button(root, 100, 100);
    first.focus();
    focusInDirection("right");
    expect(document.activeElement).toBe(right);
    focusInDirection("down");
    expect(document.activeElement).toBe(below);
    focusInDirection("up");
    expect(document.activeElement).toBe(right);
    focusInDirection("left");
    expect(document.activeElement).toBe(first);
    focusInDirection("left");
    expect(document.activeElement).toBe(first);
  });
  it("skips hidden and disabled controls", () => {
    const root = screen();
    const first = button(root, 0, 0),
      disabled = button(root, 70, 0),
      hidden = button(root, 140, 0),
      last = button(root, 210, 0);
    disabled.disabled = true;
    hidden.hidden = true;
    first.focus();
    focusInDirection("right");
    expect(document.activeElement).toBe(last);
  });
  it("keeps movement inside the top dialog", () => {
    const root = screen();
    button(root, 200, 0);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    place(dialog, 0, 0);
    const first = button(dialog, 0, 0),
      last = button(dialog, 100, 0);
    first.focus();
    focusInDirection("right");
    expect(document.activeElement).toBe(last);
    focusInDirection("right");
    expect(document.activeElement).toBe(last);
  });
  it("preserves horizontal slider editing but lets up/down leave it", () => {
    const root = screen();
    const slider = document.createElement("input");
    slider.type = "range";
    root.append(slider);
    place(slider, 0, 0);
    const below = button(root, 0, 100);
    slider.focus();
    expect(focusInDirection("right")).toBe(false);
    expect(document.activeElement).toBe(slider);
    focusInDirection("down");
    expect(document.activeElement).toBe(below);
    const text = document.createElement("input");
    root.append(text);
    text.focus();
    expect(focusInDirection("down")).toBe(false);
  });
});

describe("focusPreviousControl", () => {
  it("navigates backward through controls and wraps to the end", () => {
    const root = screen();
    const first = button(root, 0, 0);
    const second = button(root, 100, 0);
    const third = button(root, 200, 0);

    third.focus();
    focusPreviousControl();
    expect(document.activeElement).toBe(second);

    focusPreviousControl();
    expect(document.activeElement).toBe(first);

    // Wraps around from first to last
    focusPreviousControl();
    expect(document.activeElement).toBe(third);
  });

  it("confines backward navigation to an active dialog overlay", () => {
    const root = screen();
    button(root, 0, 0);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    place(dialog, 0, 0);
    const dialogFirst = button(dialog, 50, 0);
    const dialogSecond = button(dialog, 150, 0);

    dialogSecond.focus();
    focusPreviousControl();
    expect(document.activeElement).toBe(dialogFirst);

    focusPreviousControl();
    expect(document.activeElement).toBe(dialogSecond);
  });

  it("focuses the last control when no element currently has focus", () => {
    const root = screen();
    button(root, 0, 0);
    const second = button(root, 100, 0);
    document.body.focus();

    focusPreviousControl();
    expect(document.activeElement).toBe(second);
  });

  it("does nothing safely when no focusable controls exist", () => {
    screen();
    document.body.focus();
    expect(() => focusPreviousControl()).not.toThrow();
  });
});
