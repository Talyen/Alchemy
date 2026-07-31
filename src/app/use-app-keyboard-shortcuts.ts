import { useEffect } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { useLatestRef } from "@/features/alchemy/shared/hooks";
import type { Screen } from "@/lib/routing";

/** True when a Radix dismissible (Select/Dropdown/Popover) should receive Escape first. */
function isRadixEscapeTargetOpen(): boolean {
  return Boolean(
    document.querySelector(
      [
        '[data-radix-select-content][data-state="open"]',
        '[data-radix-dropdown-menu-content][data-state="open"]',
        '[data-radix-popover-content][data-state="open"]',
        '[data-radix-combobox-content][data-state="open"]',
      ].join(", "),
    ),
  );
}

export function useAppKeyboardShortcuts({
  renderedScreen,
  gameMenuOpen,
  setMenuAnchorRect,
  setGameMenuOpen,
}: {
  renderedScreen: Screen;
  gameMenuOpen: boolean;
  setMenuAnchorRect: (rect: DOMRect | null | ((prev: DOMRect | null) => DOMRect | null)) => void;
  setGameMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const gameMenuOpenRef = useLatestRef(gameMenuOpen);
  const renderedScreenRef = useLatestRef(renderedScreen);

  useEffect(() => {
    return pushEscapeHandler({
      id: "app-game-menu",
      priority: ESCAPE_PRIORITY.APP_MENU,
      onEscape: () => {
        // Decline so title-menu / open Radix Select document listeners can run.
        if (renderedScreenRef.current === "menu") return false;
        if (isRadixEscapeTargetOpen()) return false;
        if (!gameMenuOpenRef.current) setMenuAnchorRect(null);
        setGameMenuOpen((prev) => !prev);
        return;
      },
    });
  }, [gameMenuOpenRef, renderedScreenRef, setMenuAnchorRect, setGameMenuOpen]);
}
