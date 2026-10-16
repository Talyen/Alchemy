import type { CardRect } from "../../../shared/types";

export interface BattleSceneLocalRect {
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
}

export function getBattleSceneLocalRect(scene: HTMLDivElement | null): BattleSceneLocalRect | null {
  if (!scene) return null;
  const rect = scene.getBoundingClientRect();
  const scaleX = rect.width / scene.offsetWidth;
  const scaleY = rect.height / scene.offsetHeight;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX === 0 || scaleY === 0) return null;
  return { left: rect.left, top: rect.top, scaleX, scaleY };
}

export function viewportRectToBattleSceneRect(rect: CardRect, sceneRect: BattleSceneLocalRect): CardRect {
  return {
    x: (rect.x - sceneRect.left) / sceneRect.scaleX,
    y: (rect.y - sceneRect.top) / sceneRect.scaleY,
    width: rect.width / sceneRect.scaleX,
    height: rect.height / sceneRect.scaleY,
  };
}

export function defaultMeasureElementRect(
  element: HTMLElement | null,
  sceneElement: HTMLDivElement | null,
): CardRect | null {
  const sceneRect = getBattleSceneLocalRect(sceneElement);
  if (!element || !sceneRect) return null;
  const rect = element.getBoundingClientRect();
  return viewportRectToBattleSceneRect(
    { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    sceneRect,
  );
}

export function defaultMeasureVisualCardRect(
  element: HTMLElement | null,
  sceneElement: HTMLDivElement | null,
): CardRect | null {
  const sceneRect = getBattleSceneLocalRect(sceneElement);
  if (!element || !sceneRect) return null;
  const rect = element.getBoundingClientRect();

  // Border-box layout size matches getBoundingClientRect; computed-style width
  // is content-box and would offset the center by borders/padding.
  const width = element.offsetWidth || rect.width;
  const height = element.offsetHeight || rect.height;
  return {
    x: (rect.left + rect.width / 2 - sceneRect.left) / sceneRect.scaleX - width / 2,
    y: (rect.top + rect.height / 2 - sceneRect.top) / sceneRect.scaleY - height / 2,
    width,
    height,
  };
}

export function getCardRotation(element: HTMLElement | null): number | null {
  if (!element) return null;
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === "none") return 0;
  const matrix = new DOMMatrixReadOnly(transform);
  return (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
}
