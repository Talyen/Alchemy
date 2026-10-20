import { useEffect, useState } from "react";
import type { KeywordId } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { useAdaptiveGrid } from "../../shared/ui/adaptive-grid";
import { KeywordProgressCard } from "./keyword-progress-card";

export interface KeywordProgressEntry {
  kw: KeywordId;
  totalXP: number;
}

export function KeywordProgressGrid({
  entries,
  size = "md",
  className,
}: {
  entries: KeywordProgressEntry[];
  size?: "md" | "lg";
  className?: string;
}) {
  const [animate, setAnimate] = useState(false);
  const { onContainer, onMeasure, columns } = useAdaptiveGrid(224, 5, 5, 12);
  const rowCount = Math.max(1, Math.ceil(entries.length / columns));
  const smallerRowSize = Math.floor(entries.length / rowCount);
  const largerRowCount = entries.length % rowCount;
  const largestRowSize = Math.ceil(entries.length / rowCount);
  const largerRowEntries = largerRowCount * (smallerRowSize + 1);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (entries.length === 0) return null;

  return (
    <div
      ref={onContainer}
      className={cn("mx-auto grid w-full max-w-[calc(73*var(--content-rem,1rem))] justify-center gap-3", className)}
      style={{ gridTemplateColumns: `repeat(${largestRowSize * 2}, calc(6.625 * var(--content-rem, 1rem)))` }}
    >
      {entries.map(({ kw, totalXP }, index) => {
        const inLargerRow = index < largerRowEntries;
        const rowSize = smallerRowSize + (inLargerRow ? 1 : 0);
        const rowIndex = inLargerRow
          ? Math.floor(index / rowSize)
          : largerRowCount + Math.floor((index - largerRowEntries) / rowSize);
        const columnIndex = (inLargerRow ? index : index - largerRowEntries) % rowSize;

        return (
          <div
            key={kw}
            ref={index === 0 ? onMeasure : undefined}
            className="w-56"
            style={{
              gridRow: rowIndex + 1,
              gridColumn: `${largestRowSize - rowSize + columnIndex * 2 + 1} / span 2`,
            }}
          >
            <KeywordProgressCard kw={kw} totalXP={totalXP} animate={animate} size={size} />
          </div>
        );
      })}
    </div>
  );
}
