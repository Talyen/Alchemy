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
