function readStyleInset(
  style: CSSStyleDeclaration | Record<string, string>,
  camelProp: string,
  dashedProp: string,
): number {
  const direct = (style as Record<string, string>)[camelProp];
  if (typeof direct === "string") return parseFloat(direct) || 0;
  if (typeof style.getPropertyValue === "function") return parseFloat(style.getPropertyValue(dashedProp)) || 0;
  return 0;
}

function buildAdjustedDOMRect(boardRect: DOMRect, inset: { l: number; t: number; r: number; b: number }): DOMRect {
  return {
    left: boardRect.left + inset.l,
    top: boardRect.top + inset.t,
    right: boardRect.right - inset.r,
    bottom: boardRect.bottom - inset.b,
    width: boardRect.width - inset.l - inset.r,
    height: boardRect.height - inset.t - inset.b,
    x: boardRect.left + inset.l,
    y: boardRect.top + inset.t,
    toJSON: () => ({}),
  };
}

export function readInventoryBoardMetrics(board: HTMLElement): {
  cellSize: number;
  gap: number;
  boardRect: DOMRect;
  scrollTop: number;
} | null {
  const boardRect = board.getBoundingClientRect();
  const cellMetric = board.querySelector<HTMLElement>("[data-armory-grid-metric='cell']")?.getBoundingClientRect();
  const strideMetric = board.querySelector<HTMLElement>("[data-armory-grid-metric='stride']")?.getBoundingClientRect();
  if (!cellMetric || !strideMetric) return null;
  const cellSize = cellMetric.width;
  const gap = strideMetric.left - cellMetric.left - cellSize;

  const style = window.getComputedStyle(board) as CSSStyleDeclaration | Record<string, string>;
  const inset = {
    l:
      readStyleInset(style, "paddingLeft", "padding-left") +
      readStyleInset(style, "borderLeftWidth", "border-left-width"),
    t: readStyleInset(style, "paddingTop", "padding-top") + readStyleInset(style, "borderTopWidth", "border-top-width"),
    r:
      readStyleInset(style, "paddingRight", "padding-right") +
      readStyleInset(style, "borderRightWidth", "border-right-width"),
    b:
      readStyleInset(style, "paddingBottom", "padding-bottom") +
      readStyleInset(style, "borderBottomWidth", "border-bottom-width"),
  };

  return { cellSize, gap, boardRect: buildAdjustedDOMRect(boardRect, inset), scrollTop: board.scrollTop };
}
