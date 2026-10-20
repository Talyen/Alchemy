import { useEffect, useLayoutEffect } from "react";
import { focusScreenStart, isFocusAvailable } from "@/features/alchemy/shared/ui/focus-navigation";

import { isFocusNavigationEnabled, trackFocusInput } from "@/features/alchemy/shared/ui/focus-input";

/** Recover only across screen readiness boundaries after intentional focus navigation. */
export function useScreenFocus(screen: string, ready: boolean) {
  useEffect(trackFocusInput, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        if (event.key === "Tab") {
          // OS window switching must not reach native traversal or dialog traps.
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      // A held confirm must not activate the next card or newly entered screen.
      const editingText =
        event.target instanceof HTMLElement &&
        event.target.closest(
          'input[type="search"], input[type="text"], input:not([type]), textarea, [contenteditable="true"]',
        );
      if (!editingText && event.repeat && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (!ready || !isFocusNavigationEnabled()) return;
    const frame = requestAnimationFrame(() => {
      if (!isFocusNavigationEnabled()) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && isFocusAvailable(active)) return;
      focusScreenStart();
    });
    return () => cancelAnimationFrame(frame);
  }, [screen, ready]);
}
