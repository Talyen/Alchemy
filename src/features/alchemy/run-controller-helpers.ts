import { getBattleCardPlayTarget, getCardRect } from "./utils";
import type { CardGhost, CardRect } from "./types";
import type { BattleCard } from "@/lib/game-data";
import { GHOST_TRAVEL_SCALE } from "@/lib/game-constants";

export function animateCardActivation(
  card: BattleCard,
  rect: CardRect,
  rotation: number,
  playerPanelRef: React.RefObject<HTMLDivElement | null>,
  enemyPanelRef: React.RefObject<HTMLDivElement | null>,
  battleSceneRef: React.RefObject<HTMLDivElement | null>,
  spawnCardGhost: (ghost: Omit<CardGhost, "id">) => void,
) {
  const sceneRect = getBattleSceneLocalRect(battleSceneRef.current);
  const localSourceRect = sceneRect ? viewportRectToBattleSceneRect(rect, sceneRect) : rect;
  const targetRect = getCardPlayGhostTargetRect(card, playerPanelRef, enemyPanelRef, battleSceneRef, sceneRect);
  if (targetRect) {
    spawnCardGhost({
      art: card.art,
      rect: localSourceRect,
      rotation,
      delay: 0,
      variant: "play-travel",
      travel: {
        x: targetRect.x + targetRect.width / 2 - (localSourceRect.x + localSourceRect.width / 2),
        y: targetRect.y + targetRect.height / 2 - (localSourceRect.y + localSourceRect.height / 2),
        scale: GHOST_TRAVEL_SCALE,
      },
    });
    return;
  }

  spawnCardGhost({ art: card.art, rect: localSourceRect, rotation, delay: 0, variant: "activate" });
}

function getCardPlayGhostTargetRect(
  card: BattleCard,
  playerPanelRef: React.RefObject<HTMLDivElement | null>,
  enemyPanelRef: React.RefObject<HTMLDivElement | null>,
  battleSceneRef: React.RefObject<HTMLDivElement | null>,
  sceneRect: BattleSceneLocalRect | null,
) {
  const target = getBattleCardPlayTarget(card);
  const panelRect = target === "player" ? playerPanelRef.current?.getBoundingClientRect() : target === "enemy" ? enemyPanelRef.current?.getBoundingClientRect() : null;
  if (panelRect) {
    const panelTarget = sceneRect ? viewportRectToBattleSceneRect(getCardRect(panelRect), sceneRect) : getCardRect(panelRect);

    if (target === "player") {
      return {
        ...panelTarget,
        x: panelTarget.x - panelTarget.width * 0.16,
      };
    }

    return panelTarget;
  }

  const battleRect = battleSceneRef.current?.getBoundingClientRect();
  if (!battleRect) return null;

  const fallback = { x: battleRect.left + battleRect.width / 2 - 80, y: battleRect.top + battleRect.height * 0.3, width: 160, height: 220 };
  return sceneRect ? viewportRectToBattleSceneRect(fallback, sceneRect) : fallback;
}

type BattleSceneLocalRect = {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
};

// Ghosts render inside the virtual battle scene, so browser viewport rects must
// be converted back through the stage scale before CSS positions are applied.
function getBattleSceneLocalRect(scene: HTMLDivElement | null): BattleSceneLocalRect | null {
  if (!scene) return null;

  const rect = scene.getBoundingClientRect();
  const scaleX = rect.width / scene.offsetWidth;
  const scaleY = rect.height / scene.offsetHeight;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX === 0 || scaleY === 0) return null;

  return { left: rect.left, top: rect.top, scaleX, scaleY };
}

// Keeps source, target, and travel deltas in one local coordinate system, which
// prevents transformed desktop stages and mobile native layouts from diverging.
function viewportRectToBattleSceneRect(rect: CardRect, sceneRect: BattleSceneLocalRect): CardRect {
  return {
    x: (rect.x - sceneRect.left) / sceneRect.scaleX,
    y: (rect.y - sceneRect.top) / sceneRect.scaleY,
    width: rect.width / sceneRect.scaleX,
    height: rect.height / sceneRect.scaleY,
  };
}
