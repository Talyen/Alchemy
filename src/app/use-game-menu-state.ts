import { useCallback, useState } from "react";

export function useGameMenuState() {
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);

  const openBattleMenu = useCallback((rect?: DOMRect) => {
    setMenuAnchorRect(rect ?? null);
    setGameMenuOpen(true);
  }, []);

  const closeGameMenu = useCallback(() => {
    setGameMenuOpen(false);
    setMenuAnchorRect(null);
  }, []);

  return { gameMenuOpen, menuAnchorRect, openBattleMenu, closeGameMenu, setMenuAnchorRect, setGameMenuOpen };
}
