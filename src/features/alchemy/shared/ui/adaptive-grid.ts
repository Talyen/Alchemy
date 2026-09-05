import { useLayoutEffect, useState, type CSSProperties } from "react";

export function getGridCapacity(width: number, tileWidth: number, gap: number, maxColumns: number) {
  const columns = Math.max(
    1,
    Math.min(maxColumns, Math.floor((Math.max(0, width) + gap + 0.5) / Math.max(1, tileWidth + gap))),
  );
  return { columns, pageSize: columns * 2 };
}

export function anchoredPage(
  previousPage: number,
  previousSize: number,
  pageSize: number,
  itemCount: number,
  selectedIndex = -1,
) {
  const anchor = selectedIndex >= 0 ? selectedIndex : previousPage * previousSize;
  return Math.max(0, Math.min(Math.floor(anchor / pageSize), Math.ceil(itemCount / pageSize) - 1));
}

export function useAdaptiveGrid(referenceTileWidth: number, initialColumns: number, maxColumns = 8, referenceGap = 20) {
  const [container, onContainer] = useState<HTMLDivElement | null>(null);
  const [measure, onMeasure] = useState<HTMLSpanElement | null>(null);
  const [columns, setColumns] = useState(initialColumns);
  useLayoutEffect(() => {
    if (!container || !measure || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const tileWidth = parseFloat(getComputedStyle(measure).width);
      if (!(tileWidth > 0) || container.clientWidth <= 0) return;
      const scale = tileWidth / referenceTileWidth;
      setColumns(getGridCapacity(container.clientWidth, tileWidth, referenceGap * scale, maxColumns).columns);
    };
    update();
    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        update();
      });
    });
    observer.observe(container);
    observer.observe(measure);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [container, measure, referenceTileWidth, referenceGap, maxColumns]);
  return {
    onContainer,
    onMeasure,
    columns,
    pageSize: columns * 2,
    referenceTileWidth,
    gridStyle: {
      gridTemplateColumns: `repeat(${columns}, minmax(0, calc(${referenceTileWidth}px * var(--content-scale, 1))))`,
      justifyContent: "center",
    } satisfies CSSProperties,
  };
}
