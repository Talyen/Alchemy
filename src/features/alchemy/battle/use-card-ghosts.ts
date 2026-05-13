// Card ghost state for battle card animations.
// Depends only on alchemy UI ghost types.
// Used by useBattleController to spawn temporary card clones during combat feedback.
import { useState } from "react";

import type { CardGhost } from "../types";

// Manages card clone overlays so animation state can be cleared independently of battle state.
export function useCardGhosts() {
  const [cardGhosts, setCardGhosts] = useState<CardGhost[]>([]);

  function removeCardGhost(id: string) {
    setCardGhosts((current) => current.filter((ghost) => ghost.id !== id));
  }

  function clearCardGhosts() {
    setCardGhosts([]);
  }

  function spawnCardGhost(ghost: Omit<CardGhost, "id">) {
    const id = `${performance.now()}-${Math.random()}`;
    setCardGhosts((current) => [...current, { ...ghost, id }]);
  }

  return { cardGhosts, removeCardGhost, clearCardGhosts, spawnCardGhost };
}
