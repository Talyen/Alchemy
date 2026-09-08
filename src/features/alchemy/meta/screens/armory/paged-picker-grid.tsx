import { usePagination } from "../../../shared/ui/use-pagination";
import { useAdaptiveGrid } from "../../../shared/ui/adaptive-grid";
import { GridMeasurement } from "../../../shared/ui/grid-measurement";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { collectionGridGapXClass, collectionGridTileWidthClass, gearArtAspectClass } from "../../../shared/config";
import { FadeSlot } from "../../../shared/ui/use-fade";
import { PaginationControls } from "../../../shared/ui/shared-ui";

function PagedPickerGrid({
  grid: { onContainer, onMeasure, referenceTileWidth, gridStyle },
  testId,
  swapKey,
  isEmpty,
  safePage,
  totalPages,
  onPageChange,
  fillerCount,
  fillerClassName,
  fillerTestId,
  children,
}: {
  grid: ReturnType<typeof useAdaptiveGrid>;
  testId: string;
  swapKey: string;
  isEmpty: boolean;
  safePage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  fillerCount: number;
  fillerClassName: string;
  fillerTestId?: string;
  children: ReactNode;
}) {
  return (
    <section data-testid={testId} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={onContainer} className="relative w-full">
        <GridMeasurement onMeasure={onMeasure} referenceTileWidth={referenceTileWidth} />
        <FadeSlot swapKey={`${swapKey}-${safePage}`} className="relative mt-2 w-full overflow-visible">
          {isEmpty ? (
            <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center text-xl text-muted-foreground">
              Empty
            </p>
          ) : null}
          <div style={gridStyle} className={cn("grid w-full grid-rows-2", collectionGridGapXClass, "gap-y-6")}>
            {children}
            {Array.from({ length: fillerCount }, (_, index) => index).map((index) => (
              <div key={`${testId}-filler-${index}`} data-testid={fillerTestId} className={fillerClassName} />
            ))}
          </div>
        </FadeSlot>
      </div>
      <div className="mt-auto flex justify-center">
        <PaginationControls
          page={safePage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          size="default"
          reserveSpace
          className="mt-0"
        />
      </div>
    </section>
  );
}

export function useArmoryPickerPage<T>(context: string, items: T[], selectedIndex = -1) {
  const grid = useAdaptiveGrid(225, 3);
  const pageSize = grid.pageSize;
  const {
    page: safePage,
    totalPages,
    setPage: onPageChange,
  } = usePagination(items.length, pageSize, context, selectedIndex);
  const pageItems = items.slice(safePage * pageSize, (safePage + 1) * pageSize);
  return {
    grid,
    pageItems,
    fillerCount: Math.max(0, pageSize - pageItems.length),
    safePage,
    totalPages,
    onPageChange,
  };
}

export function ArmoryPagedGrid<T>({
  items,
  selectedId,
  context,
  testId,
  swapKey,
  fillerTestId,
  renderItem,
}: {
  items: T[];
  selectedId?: string | null;
  context: string;
  testId: string;
  swapKey: string;
  fillerTestId?: string;
  renderItem: (item: T) => ReactNode;
}) {
  const selectedIndex = selectedId
    ? items.findIndex(
        (item) =>
          (item as { instanceId?: unknown; id?: unknown }).instanceId === selectedId ||
          (item as { id?: unknown }).id === selectedId,
      )
    : -1;
  const { grid, pageItems, fillerCount, safePage, totalPages, onPageChange } = useArmoryPickerPage(
    context,
    items,
    selectedIndex,
  );
  return (
    <PagedPickerGrid
      grid={grid}
      testId={testId}
      swapKey={swapKey}
      isEmpty={items.length === 0}
      safePage={safePage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      fillerCount={fillerCount}
      fillerClassName={cn(collectionGridTileWidthClass, gearArtAspectClass)}
      {...(fillerTestId ? { fillerTestId } : {})}
    >
      {pageItems.map(renderItem)}
    </PagedPickerGrid>
  );
}
