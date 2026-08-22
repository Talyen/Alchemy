// Battle trinket inspect: sack chrome toggle plus a fading full-art overlay.
import { useMemo, useState } from "react";
import { ShoppingBag, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  battleTrinketInspectRowMaxWidthClass,
  trinketArtFillClass,
  trinketArtImageClass,
  trinketArtTileClass,
} from "@/features/alchemy/shared/config";
import { TRINKET_PAGE_SIZE } from "@/lib/game-constants";
import { cn } from "@/lib/utils";

import { DetailPopup } from "../../../shared/ui/card-popup";
import { FadeSlot } from "../../../shared/ui/fade-slot";
import { InteractiveArtTile } from "../../../shared/ui/interactive-art-tile";
import { ModalOverlayShell } from "../../../shared/ui/modal-overlay-shell";
import { PaginationControls, ScreenHeader } from "../../../shared/ui/shared-ui";
import { uniqueRunTrinkets } from "./unique-run-trinkets";

const INSPECT_COLUMNS = 4;

export function BattleTrinketInspectButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Button
      variant={open ? "primary" : "outline"}
      size="icon"
      className={cn("h-10 w-10", !open && "text-muted-foreground")}
      onClick={onToggle}
      data-testid="battle-trinket-inspect-toggle"
    >
      <ShoppingBag className="h-5 w-5" />
    </Button>
  );
}

export function BattleTrinketInspectOverlay({
  open,
  trinketIds,
  onClose,
}: {
  open: boolean;
  trinketIds: readonly string[];
  onClose: () => void;
}) {
  const trinkets = useMemo(() => uniqueRunTrinkets(trinketIds), [trinketIds]);
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(trinkets.length / TRINKET_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  if (!open && page !== 0) setPage(0);
  if (open && page !== safePage) setPage(safePage);

  const pageTrinkets = trinkets.slice(safePage * TRINKET_PAGE_SIZE, (safePage + 1) * TRINKET_PAGE_SIZE);
  const rows = Array.from({ length: Math.ceil(pageTrinkets.length / INSPECT_COLUMNS) }, (_, rowIndex) =>
    pageTrinkets.slice(rowIndex * INSPECT_COLUMNS, rowIndex * INSPECT_COLUMNS + INSPECT_COLUMNS),
  );

  return (
    <ModalOverlayShell
      open={open}
      escapeId="battle-trinket-inspect"
      onClose={onClose}
      dismissOnBackdrop
      zIndex={80}
      testId="battle-trinket-inspect-overlay"
      mount={trinkets.length > 0}
      className="flex items-center justify-center px-6 py-8"
    >
      <div
        className="alchemy-shell relative w-fit max-w-full rounded-shell-screen border border-border/80 px-8 py-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid w-full grid-cols-[2.5rem_1fr_2.5rem] items-start">
          <span />
          <ScreenHeader title="Trinkets" />
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 justify-self-end text-muted-foreground"
            onClick={onClose}
            aria-label="Close trinkets"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <FadeSlot swapKey={safePage} className={cn("mt-6 flex flex-col gap-y-6", battleTrinketInspectRowMaxWidthClass)}>
          {rows.map((row) => (
            <div key={row.map((trinket) => trinket.id).join("-")} className="flex justify-center gap-x-6">
              {row.map((trinket) => (
                <InteractiveArtTile
                  key={trinket.id}
                  id={trinket.id}
                  interactionKey="battle-trinket"
                  title={trinket.title}
                  art={trinket.art}
                  as="div"
                  className={trinketArtTileClass}
                  imageClassName={cn(trinketArtFillClass, trinketArtImageClass)}
                  popup={({ visible, triggerRef }) => (
                    <DetailPopup
                      idPrefix={`battle-trinket-${trinket.id}`}
                      title={trinket.title}
                      footerChip="This Run"
                      descriptionLines={trinket.descriptionLines}
                      visible={visible}
                      triggerRef={triggerRef}
                    />
                  )}
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
