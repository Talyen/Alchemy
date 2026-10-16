import { useEffect, useLayoutEffect, useRef } from "react";
import { focusScreenStart, isFocusAvailable } from "@/features/alchemy/shared/ui/focus-navigation";

/** Recover only across screen readiness boundaries, and only after keyboard input. */
export function useScreenFocus(screen: string, ready: boolean) {
  const keyboard = useRef(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        keyboard.current = false;
        if (event.key === "Tab") {
          // OS window switching must not reach native traversal or dialog traps.
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      } else if (
        ["Tab", "F7", "Enter", " ", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        keyboard.current = true;
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
    const onPointer = () => {
      keyboard.current = false;
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("blur", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("blur", onPointer);
    };
  }, []);

  useLayoutEffect(() => {
    if (!ready || !keyboard.current) return;
    const frame = requestAnimationFrame(() => {
      if (!keyboard.current) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && isFocusAvailable(active)) return;
      focusScreenStart();
    });
    return () => cancelAnimationFrame(frame);
  }, [screen, ready]);
}
