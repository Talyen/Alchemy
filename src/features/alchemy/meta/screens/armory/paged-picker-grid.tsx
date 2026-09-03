import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { collectionGridGapXClass } from "../../../shared/config";
import { FadeSlot } from "../../../shared/ui/fade-slot";
import { PaginationControls } from "../../../shared/ui/shared-ui";

export const PICKER_PAGE_SIZE = 6;
const FILLER_INDICES = Array.from({ length: PICKER_PAGE_SIZE }, (_, i) => i);

function useContextPagedGrid(context: string, itemCount: number, pageSize = PICKER_PAGE_SIZE) {
  const [paging, setPaging] = useState({ context, page: 0 });
  const page = paging.context === context ? paging.page : 0;
  const totalPages = Math.max(1, Math.ceil(itemCount / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  return {
    safePage,
    totalPages,
    onPageChange: (nextPage: number) => setPaging({ context, page: nextPage }),
  };
}

export function PagedPickerGrid({
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
      <FadeSlot swapKey={`${swapKey}-${safePage}`} className="relative mt-2 w-full overflow-visible">
        {isEmpty ? (
          <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center text-xl text-muted-foreground">
            Empty
          </p>
        ) : null}
        <div className={cn("grid w-full grid-cols-3 grid-rows-2", collectionGridGapXClass, "gap-y-6")}>
          {children}
          {FILLER_INDICES.slice(0, fillerCount).map((index) => (
            <div key={`${testId}-filler-${index}`} data-testid={fillerTestId} className={fillerClassName} />
          ))}
        </div>
      </FadeSlot>
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

export function pickerPageSlice<T>(items: T[], safePage: number, pageSize = PICKER_PAGE_SIZE): T[] {
  return items.slice(safePage * pageSize, (safePage + 1) * pageSize);
}

export function pickerFillerCount(visibleCount: number, pageSize = PICKER_PAGE_SIZE): number {
  return Math.max(0, pageSize - visibleCount);
}

export function useArmoryPickerPage<T>(context: string, items: T[], pageSize = PICKER_PAGE_SIZE) {
  const { safePage, totalPages, onPageChange } = useContextPagedGrid(context, items.length, pageSize);
  const pageItems = pickerPageSlice(items, safePage, pageSize);
  return { pageItems, fillerCount: pickerFillerCount(pageItems.length, pageSize), safePage, totalPages, onPageChange };
}
