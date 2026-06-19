import { useEffect, useRef } from "react";
import type { Screen } from "@/lib/routing";

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
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && renderedScreenRef.current !== "menu") {
        if (!gameMenuOpenRef.current) setMenuAnchorRect(null);
        setGameMenuOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setMenuAnchorRect, setGameMenuOpen]);
}
