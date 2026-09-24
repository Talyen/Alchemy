import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { useLatestRef } from "@/features/alchemy/shared/ui/use-latest-ref";
import type { Screen } from "@/lib/routing";
import { useEffect } from "react";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs intentionally keep a single subscription current
  }, []);
}
