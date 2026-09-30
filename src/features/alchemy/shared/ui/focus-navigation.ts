/** Shared eligibility for recovery and dialog traversal; inspection-only controls remain tabbable. */
export function isFocusAvailable(element: HTMLElement): boolean {
  return (
    element.isConnected &&
    !element.closest('[inert], [hidden], [aria-hidden="true"]') &&
    !element.matches(":disabled") &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden"
  );
}

export function focusableControls(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]")].filter(
    (element) => element.tabIndex >= 0 && isFocusAvailable(element),
  );
}

export function focusControl(element: HTMLElement | undefined | null): boolean {
  if (!element || element === document.body || !isFocusAvailable(element)) return false;
  element.focus({ preventScroll: true });
  if (document.activeElement !== element) return false;
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

export function focusScreenStart() {
  const screen = document.querySelector("[data-screen-content]:not([inert])");
  if (!screen) return;
  const controls = focusableControls(screen);
  focusControl(controls.find((element) => element.getAttribute("aria-disabled") !== "true"));
}

/** Steam Input uses F7 so backward focus does not activate Steam's Shift+Tab overlay. */
export function focusPreviousControl(): void {
  const root = activeFocusRoot();
  const controls = focusableControls(root);
  const current = controls.indexOf(document.activeElement as HTMLElement);
  focusControl(controls[(current <= 0 ? controls.length : current) - 1]);
}

function activeFocusRoot(): ParentNode {
  const overlays = [...document.querySelectorAll<HTMLElement>('[role="dialog"], [data-modal-content]')].filter(
    isFocusAvailable,
  );
  return overlays.at(-1) ?? document.querySelector("[data-screen-content]:not([inert])") ?? document;
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
      (current.type !== "range" || direction === "left" || direction === "right")
    )
      return false;
    if (current.matches('[role="slider"]') && (direction === "left" || direction === "right")) return false;
  }
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
