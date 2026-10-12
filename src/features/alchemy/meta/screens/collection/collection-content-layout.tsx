import type { ReactNode } from "react";
import { COLLECTION_CARD_REFERENCE_WIDTH } from "../../../shared/config";

export function CollectionContentLayout({ children, pagination }: { children: ReactNode; pagination: ReactNode }) {
  // Two portrait rows are taller than the bestiary's landscape rows. Reserve
  // their full height on every tab, including partial pages and single-row tabs.
  const rowsHeight = COLLECTION_CARD_REFERENCE_WIDTH * (4 / 3) * 2 + 32;

  return (
    <div className="mt-6 flex flex-col items-center gap-4 overflow-visible">
      <div
        className="flex w-full shrink-0 items-center overflow-visible"
        style={{ height: `calc(${rowsHeight}px * var(--content-scale, 1) + 4px)` }}
      >
        {children}
      </div>
      <div className="flex h-14 shrink-0 items-center justify-center">{pagination}</div>
    </div>
  );
}
