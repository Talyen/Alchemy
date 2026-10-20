/** Focus navigation is opt-in; dismissal and pointer input never arm recovery. */
export function isFocusNavigationEnabled(): boolean {
  return document.documentElement.dataset.focusNavigation === "true";
}

export function enableFocusNavigation(): void {
  document.documentElement.dataset.focusNavigation = "true";
}

export function trackFocusInput(): () => void {
  const cancel = () => {
    document.documentElement.dataset.focusNavigation = "false";
  };
  cancel();
  const onKey = (event: KeyboardEvent) => {
    // oxlint-disable-next-line typescript/no-deprecated -- Ignore legacy IME commit events as well as composing events.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.altKey || event.ctrlKey || event.metaKey) {
      cancel();
    } else if (event.key === "Escape") {
      cancel();
      // A dismissal must not turn pointer-retained focus into keyboard inspection.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    } else if (["Tab", "F7", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      const target = event.target;
      const editing =
        target instanceof HTMLElement &&
        (target.closest(
          'textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="menu"], input:not([type="checkbox"]):not([type="range"])',
        ) !== null ||
          ((event.key === "ArrowLeft" || event.key === "ArrowRight") &&
            target.matches('input[type="range"], [role="slider"]')));
      if (event.key === "Tab" || event.key === "F7" || !editing) enableFocusNavigation();
    }
  };
  window.addEventListener("keydown", onKey, true);
  document.addEventListener("pointerdown", cancel, true);
  window.addEventListener("blur", cancel);
  return () => {
    window.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", cancel, true);
    window.removeEventListener("blur", cancel);
    cancel();
  };
}
