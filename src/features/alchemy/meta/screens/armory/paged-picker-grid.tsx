import { PackageOpen } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { collectionGridGapXClass, collectionGridTileWidthClass, gearArtAspectClass } from "../../../shared/config";
import { FadeSlot } from "../../../shared/ui/use-fade";
import { PaginationControls } from "../../../shared/ui/navigation";

const ARMORY_PICKER_COLUMNS = 3;

const armoryPickerGridStyle = {
  gridTemplateColumns: `repeat(${ARMORY_PICKER_COLUMNS}, minmax(0, 1fr))`,
  justifyContent: "center",
} satisfies CSSProperties;

function PagedPickerGrid({
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
      <div className="relative w-full">
        <FadeSlot swapKey={`${swapKey}-${safePage}`} className="relative mt-2 w-full overflow-visible">
          {isEmpty ? (
            <div
              data-testid={`${testId}-empty`}
              role="img"
              aria-label="Empty"
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-muted-foreground"
            >
              <PackageOpen aria-hidden="true" className="h-12 w-12" />
            </div>
          ) : null}
          <div
            style={armoryPickerGridStyle}
            className={cn("grid w-full grid-rows-2", collectionGridGapXClass, "gap-y-6")}
          >
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

// Pagination state is owned by useArmoryOrdering (ARMORY_PAGE_SIZE); the page
// size here must stay ROWS x COLUMNS so filler slots complete the last page.
export function ArmoryPagedGrid<T>({
  items,
  testId,
  swapKey,
  fillerTestId,
  renderItem,
  page,
  totalPages,
  onPageChange,
  fillerCount,
  pageItems,
  placeholderIndex,
}: {
  items: T[];
  testId: string;
  swapKey: string;
  fillerTestId?: string;
  renderItem: (item: T) => ReactNode;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  fillerCount: number;
  pageItems: T[];
  placeholderIndex?: number | null | undefined;
}) {
  const hasPlaceholder = placeholderIndex !== null && placeholderIndex !== undefined;
  const effectiveFillerCount = hasPlaceholder ? Math.max(0, fillerCount - 1) : fillerCount;

  const renderedElements: ReactNode[] = [];
  let itemIdx = 0;
  const totalSlots = pageItems.length + (hasPlaceholder ? 1 : 0);
  for (let i = 0; i < totalSlots; i++) {
    if (hasPlaceholder && i === placeholderIndex) {
      renderedElements.push(
        <div
          key={`${testId}-placeholder-${i}`}
          data-testid={`${testId}-placeholder`}
          className={cn(collectionGridTileWidthClass, gearArtAspectClass)}
          aria-hidden="true"
        />,
      );
    } else if (itemIdx < pageItems.length) {
      const currentItem = pageItems[itemIdx];
      if (currentItem !== undefined) {
        renderedElements.push(renderItem(currentItem));
      }
      itemIdx++;
    }
  }

  return (
    <PagedPickerGrid
      testId={testId}
      swapKey={swapKey}
      isEmpty={items.length === 0 && !hasPlaceholder}
      safePage={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      fillerCount={effectiveFillerCount}
      fillerClassName={cn(collectionGridTileWidthClass, gearArtAspectClass)}
      {...(fillerTestId ? { fillerTestId } : {})}
    >
      {renderedElements}
    </PagedPickerGrid>
  );
}
