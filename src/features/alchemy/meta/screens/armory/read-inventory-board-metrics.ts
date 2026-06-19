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
  const paddingLeft = parseFloat(style.paddingLeft || "0") || 0;
  const paddingTop = parseFloat(style.paddingTop || "0") || 0;
  const paddingRight = parseFloat(style.paddingRight || "0") || 0;
  const paddingBottom = parseFloat(style.paddingBottom || "0") || 0;
  const borderLeft = parseFloat(style.borderLeftWidth || "0") || 0;
  const borderTop = parseFloat(style.borderTopWidth || "0") || 0;
  const borderRight = parseFloat(style.borderRightWidth || "0") || 0;
  const borderBottom = parseFloat(style.borderBottomWidth || "0") || 0;

  const adjustedRect = {
    left: boardRect.left + paddingLeft + borderLeft,
    top: boardRect.top + paddingTop + borderTop,
    right: boardRect.right - paddingRight - borderRight,
    bottom: boardRect.bottom - paddingBottom - borderBottom,
    width: boardRect.width - paddingLeft - paddingRight - borderLeft - borderRight,
    height: boardRect.height - paddingTop - paddingBottom - borderTop - borderBottom,
    x: boardRect.left + paddingLeft + borderLeft,
    y: boardRect.top + paddingTop + borderTop,
    toJSON: () => ({}),
  } as DOMRect;

  return { cellSize, gap, boardRect: adjustedRect, scrollTop: board.scrollTop };
}
