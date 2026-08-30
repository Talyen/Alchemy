import type { CardRect } from "../types";

export function getCardRect(element: DOMRect): CardRect {
  return { x: element.x, y: element.y, width: element.width, height: element.height };
}
