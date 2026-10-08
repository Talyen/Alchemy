import {
  focusPreviousControl,
  focusInDirection,
  type FocusDirection,
} from "@/features/alchemy/shared/ui/focus-navigation";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { useLatestRef } from "@/features/alchemy/shared/ui/use-latest-ref";
import type { Screen } from "@/lib/routing";
import { useEffect } from "react";

const RADIX_OPEN_SELECTOR =
  '[data-radix-select-content][data-state="open"], [data-radix-dropdown-menu-content][data-state="open"], [data-radix-popover-content][data-state="open"], [data-radix-combobox-content][data-state="open"]';

const ARROW_DIRECTIONS: Readonly<Record<string, FocusDirection>> = Object.freeze({
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
});

function isRadixEscapeTargetOpen(): boolean {
  return Boolean(document.querySelector(RADIX_OPEN_SELECTOR));
}

export function useAppKeyboardShortcuts({
  renderedScreen,
  screenInteractive,
  gameMenuOpen,
  onBack,
  toggleGameMenu,
}: {
  renderedScreen: Screen;
  screenInteractive: boolean;
  gameMenuOpen: boolean;
  onBack?: (() => void) | undefined;
  toggleGameMenu: () => void;
}) {
  const screenInteractiveRef = useLatestRef(screenInteractive);
  const gameMenuOpenRef = useLatestRef(gameMenuOpen);
  const renderedScreenRef = useLatestRef(renderedScreen);
  const onBackRef = useLatestRef(onBack);
  const toggleGameMenuRef = useLatestRef(toggleGameMenu);

  useEffect(() => {
    const previousFocus = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !screenInteractiveRef.current)
        return;
      if (
        event.key === "Enter" &&
        !event.repeat &&
        event.target instanceof HTMLInputElement &&
        event.target.type === "checkbox" &&
        !event.target.disabled
      ) {
        event.preventDefault();
        event.target.click();
        return;
      }
      if (event.key === "F7" && !event.repeat) {
        event.preventDefault();
        focusPreviousControl();
        return;
      }
      const direction = ARROW_DIRECTIONS[event.key];
      if (direction && !isRadixEscapeTargetOpen() && focusInDirection(direction)) event.preventDefault();
    };
    document.addEventListener("keydown", previousFocus);
    return () => document.removeEventListener("keydown", previousFocus);
  }, [screenInteractiveRef]);

  // Subscribe once; latest refs keep the Escape stack fresh without resubscribing.
  useEffect(() => {
    const removeBackHandler = pushEscapeHandler({
      id: "app-screen-back",
      priority: ESCAPE_PRIORITY.SCREEN_OVERLAY,
      onEscape: () => {
        if (isRadixEscapeTargetOpen()) return false;
        if (gameMenuOpenRef.current || !screenInteractiveRef.current) return false;
        if (onBackRef.current) {
          onBackRef.current();
          return;
        }
        return false;
      },
    });

    const removeMenuHandler = pushEscapeHandler({
      id: "app-game-menu",
      priority: ESCAPE_PRIORITY.APP_MENU,
      onEscape: () => {
        // An existing menu remains dismissible while navigation is locked.
        if (!screenInteractiveRef.current && !gameMenuOpenRef.current) return false;
        if (renderedScreenRef.current === "menu") return false;
        if (isRadixEscapeTargetOpen()) return false;
        toggleGameMenuRef.current();
        return;
      },
    });

    return () => {
      removeBackHandler();
      removeMenuHandler();
    };
    // oxlint-disable-next-line react/exhaustive-deps -- refs intentionally keep a single subscription current
  }, []);
}
