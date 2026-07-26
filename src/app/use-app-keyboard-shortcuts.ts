import { useEffect, useRef } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
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
  const gameMenuOpenRef = useRef(gameMenuOpen);
  const renderedScreenRef = useRef(renderedScreen);

  useEffect(() => {
    gameMenuOpenRef.current = gameMenuOpen;
  }, [gameMenuOpen]);
  useEffect(() => {
    renderedScreenRef.current = renderedScreen;
  }, [renderedScreen]);

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
  }, [setMenuAnchorRect, setGameMenuOpen]);
}
