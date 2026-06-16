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
  return { cellSize, gap, boardRect, scrollTop: board.scrollTop };
}
