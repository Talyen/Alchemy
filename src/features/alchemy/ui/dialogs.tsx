// Modal confirmation overlays for destructive or blocking game actions.
// Depends on the shared Button primitive and Lucide warning icon.
// Used by menus and screens that need explicit player confirmation.
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const DIALOG_CONFIG = {
  dangerTone: "danger",
} as const;

export function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  dimBackground = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  dimBackground?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className={`motion-overlay absolute inset-0 z-[120] flex items-center justify-center px-6 ${dimBackground ? "bg-black/70" : ""}`}
    >
      <div className="motion-panel alchemy-shell w-full max-w-[41.48cqh] rounded-[26px] border border-border/80 px-6 py-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-200">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="font-display mt-4 text-base font-bold text-amber-100/75">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === DIALOG_CONFIG.dangerTone ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
