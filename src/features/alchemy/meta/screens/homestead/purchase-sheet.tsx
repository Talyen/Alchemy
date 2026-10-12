import { useId } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import { ChromeIconButton } from "../../../shared/ui/chrome-icon-button";
import { HomesteadResourceArtwork } from "../../../shared/ui/material-icons";
import { ModalOverlayShell } from "../../../shared/ui/modal-overlay-shell";
import { useDialogFocus } from "../../../shared/ui/use-dialog-focus";
import { type HomesteadNodeModel } from "./node-model";

export function HomesteadPurchaseSheet({
  open,
  quote,
  inventory,
  saving,
  changed,
  error,
  onClose,
  onPurchase,
}: {
  open: boolean;
  quote: HomesteadNodeModel | null;
  inventory: MaterialInventory;
  saving: boolean;
  changed: boolean;
  error: string | null;
  onClose: () => void;
  onPurchase: () => void;
}) {
  return (
    <ModalOverlayShell
      open={open}
      escapeId="homestead-purchase"
      zIndex={80}
      onClose={onClose}
      dismissOnBackdrop
      className="motion-overlay flex items-center justify-center overflow-y-auto p-5"
    >
      {quote && (
        <PurchasePanel
          quote={quote}
          inventory={inventory}
          saving={saving}
          changed={changed}
          error={error}
          onClose={onClose}
          onPurchase={onPurchase}
        />
      )}
    </ModalOverlayShell>
  );
}

function PurchasePanel({
  quote,
  inventory,
  saving,
  changed,
  error,
  onClose,
  onPurchase,
}: Omit<Parameters<typeof HomesteadPurchaseSheet>[0], "open" | "quote"> & { quote: HomesteadNodeModel }) {
  const titleId = useId();
  const statusId = useId();
  const { panelRef, handleKeyDown } = useDialogFocus();
  const cost = quote.cost;
  const materials = MATERIAL_IDS.filter((material) => (cost?.[material] ?? 0) > 0);
  const affordable = cost !== null && materials.every((material) => inventory[material] >= cost[material]);
  const status = saving
    ? "Saving…"
    : changed
      ? "This upgrade has changed. Close to review."
      : (error ?? (!affordable ? "More materials needed" : null));
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the shared dialog focus hook traps Tab within this focusable modal panel
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={status ? statusId : undefined}
      aria-busy={saving}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="relative my-auto w-full max-w-sm rounded-2xl border border-border bg-background p-7 shadow-2xl"
    >
      <ChromeIconButton className="absolute top-3 right-3" onClick={onClose} aria-label="Close" data-dialog-cancel>
        <X className="h-5 w-5" />
      </ChromeIconButton>
      <p className="pr-10 text-xs tracking-widest text-muted-foreground uppercase">{quote.action} cost</p>
      <h2 id={titleId} className="mt-2 pr-8 text-2xl font-semibold text-foreground">
        {quote.title}
      </h2>
      <dl className="my-7 space-y-5">
        {materials.map((material) => (
          <div key={material} className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-3 text-foreground/90">
              <HomesteadResourceArtwork resource={material} size="lg" alt="" />
              {materialLabels[material]}
            </dt>
            <dd className="text-right tabular-nums">
              <span
                className={cn("text-xl font-semibold", inventory[material] < cost![material] && "text-destructive")}
              >
                {cost![material]}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{inventory[material]} owned</span>
            </dd>
          </div>
        ))}
      </dl>
      <Button
        className="w-full"
        disabled={saving || changed || !affordable}
        onClick={onPurchase}
        aria-describedby={status ? statusId : undefined}
      >
        {saving ? "Saving…" : quote.action}
      </Button>
      <p id={statusId} role="status" className="mt-3 min-h-5 text-center text-sm text-muted-foreground">
        {status}
      </p>
    </div>
  );
}
