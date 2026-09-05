import { useMemo } from "react";
import { ShoppingBag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { battleTrinketInspectRowMaxWidthClass } from "@/features/alchemy/shared/config";
import { TRINKET_PAGE_SIZE } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import { FadeSlot } from "../../../shared/ui/use-fade";
import { ModalOverlayShell } from "../../../shared/ui/modal-overlay-shell";
import { PaginationControls, ScreenHeader } from "../../../shared/ui/shared-ui";
import { TrinketTile } from "../../../shared/ui/collection-art-tiles";
import { usePaginatedRows } from "../../../shared/ui/use-paginated-rows";
import { uniqueRunBoons } from "./unique-run-boons";

const INSPECT_COLUMNS = 4;

export function BattleBoonInspectButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Button
      variant={open ? "primary" : "outline"}
      size="icon"
      className={cn("h-12 w-12", !open && "text-muted-foreground")}
      onClick={onToggle}
      aria-label={open ? "Close Boons" : "Inspect Boons"}
      data-testid="battle-boon-inspect-toggle"
    >
      <ShoppingBag className="h-6 w-6" />
    </Button>
  );
}

export function BattleBoonInspectOverlay({
  open,
  trinketIds,
  onClose,
}: {
  open: boolean;
  trinketIds: readonly string[];
  onClose: () => void;
}) {
  const trinkets = useMemo(() => uniqueRunBoons(trinketIds), [trinketIds]);
  const {
    page: safePage,
    totalPages,
    rows,
    setPage,
  } = usePaginatedRows(trinkets, TRINKET_PAGE_SIZE, INSPECT_COLUMNS, open);

  return (
    <ModalOverlayShell
      open={open}
      escapeId="battle-boon-inspect"
      onClose={onClose}
      dismissOnBackdrop
      zIndex={80}
      testId="battle-boon-inspect-overlay"
      mount={trinkets.length > 0}
      className="flex items-center justify-center px-6 py-8"
    >
      <div
        className="alchemy-shell relative w-fit max-w-full rounded-shell-screen border border-border/80 px-8 py-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid w-full grid-cols-[calc(2.5*var(--content-rem,1rem))_1fr_calc(2.5*var(--content-rem,1rem))] items-start">
          <span />
          <ScreenHeader title="Boons" />
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 text-muted-foreground"
            wrapperClassName="justify-self-end"
            onClick={onClose}
            aria-label="Close boons"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <FadeSlot swapKey={safePage} className={cn("mt-6 flex flex-col gap-y-6", battleTrinketInspectRowMaxWidthClass)}>
          {rows.map((row) => (
            <div key={row.map((trinket) => trinket.id).join("-")} className="flex justify-center gap-x-6">
              {row.map((trinket) => (
                <TrinketTile
                  key={trinket.id}
                  trinket={trinket}
                  interactionKey="battle-trinket"
                  idPrefix={`battle-trinket-${trinket.id}`}
                  as="div"
                  temporary
                />
              ))}
            </div>
          ))}
        </FadeSlot>

        <div className="flex justify-center">
          <PaginationControls page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>
    </ModalOverlayShell>
  );
}
