import { useLayoutEffect, useState, type CSSProperties } from "react";

export function getGridCapacity(width: number, tileWidth: number, gap: number, maxColumns: number) {
  const columns = Math.max(
    1,
    Math.min(maxColumns, Math.floor((Math.max(0, width) + gap + 0.5) / Math.max(1, tileWidth + gap))),
  );
  return { columns, pageSize: columns * 2 };
}

export function useAdaptiveGrid(referenceTileWidth: number, initialColumns: number, maxColumns = 8, referenceGap = 20) {
  const [container, onContainer] = useState<HTMLDivElement | null>(null);
  const [measure, onMeasure] = useState<HTMLSpanElement | null>(null);
  const [measurement, setMeasurement] = useState<{ width: number; scale: number } | null>(null);
  const columns = measurement
    ? getGridCapacity(
        measurement.width,
        referenceTileWidth * measurement.scale,
        referenceGap * measurement.scale,
        maxColumns,
      ).columns
    : initialColumns;
  useLayoutEffect(() => {
    if (!container || !measure || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const tileWidth = parseFloat(getComputedStyle(measure).width);
      if (!(tileWidth > 0) || container.clientWidth <= 0) return;
      const scale = tileWidth / referenceTileWidth;
      const width = container.clientWidth;
      setMeasurement((previous) =>
        previous?.width === width && previous.scale === scale ? previous : { width, scale },
      );
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
  }, [container, measure, referenceTileWidth]);
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
