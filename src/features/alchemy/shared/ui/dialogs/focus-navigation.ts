import { enableFocusNavigation } from "./focus-input";
import { focusableControls, focusControl, isFocusAvailable } from "./focus-eligibility";
import { activeDialogFocusRoot } from "./dialog-focus-owner";

export { isFocusAvailable, focusableControls, focusControl, focusScreenStart } from "./focus-eligibility";

/** Steam Input uses F7 so backward focus does not activate Steam's Shift+Tab overlay. */
export function focusPreviousControl(): void {
  enableFocusNavigation();
  const root = activeFocusRoot();
  const controls = focusableControls(root);
  const current = controls.indexOf(document.activeElement as HTMLElement);
  focusControl(controls[(current <= 0 ? controls.length : current) - 1]);
}

function activeFocusRoot(): ParentNode {
  const owned = activeDialogFocusRoot();
  if (owned) return owned;
  const overlays = document.querySelectorAll<HTMLElement>('[role="dialog"], [data-modal-content]');
  for (let index = overlays.length - 1; index >= 0; index--) {
    const overlay = overlays[index]!;
    if (isFocusAvailable(overlay)) return overlay;
  }
  return document.querySelector("[data-screen-content]:not([inert])") ?? document;
}

export type FocusDirection = "left" | "right" | "up" | "down";

/** Follow screen geometry; preserve local editing and dropdown keyboard behavior. */
export function focusInDirection(direction: FocusDirection): boolean {
  const current = document.activeElement;
  if (current instanceof HTMLElement) {
    if (
      current.closest('textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="menu"]')
    )
      return false;
    if (
      current instanceof HTMLInputElement &&
      current.type !== "checkbox" &&
      (current.type !== "range" || direction === "left" || direction === "right")
    )
      return false;
    if (current.matches('[role="slider"]') && (direction === "left" || direction === "right")) return false;
  }
  enableFocusNavigation();
  const controls = focusableControls(activeFocusRoot());
  if (!(current instanceof HTMLElement) || !controls.includes(current)) {
    return focusControl(controls[0]);
  }
  const origin = current.getBoundingClientRect();
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const primary = horizontal ? (origin.left + origin.right) / 2 : (origin.top + origin.bottom) / 2;
  const cross = horizontal ? (origin.top + origin.bottom) / 2 : (origin.left + origin.right) / 2;
  let target: HTMLElement | undefined;
  let best = Infinity;
  for (const control of controls) {
    if (control === current) continue;
    const rect = control.getBoundingClientRect();
    const distance = sign * ((horizontal ? (rect.left + rect.right) / 2 : (rect.top + rect.bottom) / 2) - primary);
    if (distance <= 1) continue;
    const offset = Math.abs((horizontal ? (rect.top + rect.bottom) / 2 : (rect.left + rect.right) / 2) - cross);
    // Prefer the same row or column before diagonally placed controls.
    const score = distance + offset * 3;
    if (score < best) {
      target = control;
      best = score;
    }
  }
  focusControl(target);
  return true;
}
