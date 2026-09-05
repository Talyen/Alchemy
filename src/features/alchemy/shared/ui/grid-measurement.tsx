import type { Ref } from "react";

export function GridMeasurement({
  onMeasure,
  referenceTileWidth,
}: {
  onMeasure: Ref<HTMLSpanElement>;
  referenceTileWidth: number;
}) {
  return (
    <span
      ref={onMeasure}
      aria-hidden="true"
      className="pointer-events-none invisible absolute h-0"
      style={{ width: `calc(${referenceTileWidth}px * var(--content-scale, 1))` }}
    />
  );
}
