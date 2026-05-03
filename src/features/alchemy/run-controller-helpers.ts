import { getBattleCardPlayTarget, getCardRect } from "./utils";
import type { CardGhost, CardRect } from "./types";
import type { BattleCard } from "@/lib/game-data";

export function animateRemainingHandDiscard(
  cards: BattleCard[],
  handCardRefs: React.RefObject<Record<string, HTMLButtonElement | null>>,
  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void,
) {
  cards.forEach((card, index) => {
    const element = handCardRefs.current[`${card.id}-${index}`];
    if (!element) {
      return;
    }

    spawnCardGhost({ art: card.art, rect: getCardRect(element.getBoundingClientRect()), rotation: (index - (cards.length - 1) / 2) * 4.2, delay: index * 45, variant: "discard-out" });
  });
}

export function animateCardActivation(
  card: BattleCard,
  rect: CardRect,
  rotation: number,
  playerPanelRef: React.RefObject<HTMLDivElement | null>,
  enemyPanelRef: React.RefObject<HTMLDivElement | null>,
  battleSceneRef: React.RefObject<HTMLDivElement | null>,
  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void,
) {
  const targetRect = getCardPlayGhostTargetRect(card, playerPanelRef, enemyPanelRef, battleSceneRef);
  if (targetRect) {
    spawnCardGhost({ art: card.art, rect, rotation, delay: 0, variant: "play-travel", travel: { x: targetRect.x + targetRect.width / 2 - (rect.x + rect.width / 2), y: targetRect.y + targetRect.height / 2 - (rect.y + rect.height / 2), scale: 0.74 } });
    return;
  }

  spawnCardGhost({ art: card.art, rect, rotation, delay: 0, variant: "activate" });
}

export function isPointerInBattlefield(pointerX: number, pointerY: number, battleSceneRef: React.RefObject<HTMLDivElement | null>) {
  const rect = battleSceneRef.current?.getBoundingClientRect();
  return Boolean(rect && pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.top + rect.height * 0.74);
}

function getCardPlayGhostTargetRect(
  card: BattleCard,
  playerPanelRef: React.RefObject<HTMLDivElement | null>,
  enemyPanelRef: React.RefObject<HTMLDivElement | null>,
  battleSceneRef: React.RefObject<HTMLDivElement | null>,
) {
  const target = getBattleCardPlayTarget(card);
  const panelRect = target === "player" ? playerPanelRef.current?.getBoundingClientRect() : target === "enemy" ? enemyPanelRef.current?.getBoundingClientRect() : null;
  if (panelRect) {
    const panelTarget = getCardRect(panelRect);

    if (target === "player") {
      return {
        ...panelTarget,
        x: panelTarget.x - panelTarget.width * 0.16,
      };
    }

    return panelTarget;
  }

  const battleRect = battleSceneRef.current?.getBoundingClientRect();
  return battleRect ? { x: battleRect.left + battleRect.width / 2 - 80, y: battleRect.top + battleRect.height * 0.3, width: 160, height: 220 } : null;
}