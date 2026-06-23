function readStyleInset(style: CSSStyleDeclaration, prop: string): number {
  return parseFloat(style.getPropertyValue(prop)) || 0;
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
  } as DOMRect;
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

  const style = window.getComputedStyle(board);
  const inset = {
    l: readStyleInset(style, "padding-left") + readStyleInset(style, "border-left-width"),
    t: readStyleInset(style, "padding-top") + readStyleInset(style, "border-top-width"),
    r: readStyleInset(style, "padding-right") + readStyleInset(style, "border-right-width"),
    b: readStyleInset(style, "padding-bottom") + readStyleInset(style, "border-bottom-width"),
  };

  return { cellSize, gap, boardRect: buildAdjustedDOMRect(boardRect, inset), scrollTop: board.scrollTop };
}
