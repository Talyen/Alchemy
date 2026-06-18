// Modal confirmation overlays for destructive or blocking game actions.
// Depends on the shared Button primitive and Lucide icons.
// Used by menus and screens that need explicit player confirmation.
import { useEffect, type ComponentType } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  // Intentional: icon is replaceable so callers can pass salvage/material themed icons
  icon: Icon = AlertTriangle,
  onConfirm,
  onCancel,
}: {
  title: React.ReactNode;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  dimBackground?: boolean;
  dismissOnBackdrop?: boolean;
  dismissOnEscape?: boolean;
  icon?: ComponentType<{ className?: string }>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!dismissOnEscape) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [dismissOnEscape, onCancel]);

  return (
    <div
      className={cn(
        "motion-overlay fixed inset-0 z-[120] flex items-center justify-center px-6",
        dimBackground ? "bg-black/70" : "bg-transparent",
      )}
      onClick={dismissOnBackdrop ? onCancel : undefined}
    >
      <div
        className="motion-panel alchemy-shell w-full max-w-[41.48cqh] rounded-shell-dialog border border-border/80 px-6 py-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-200">
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="font-display mt-4 text-base font-bold text-amber-100/75">{title}</h2>
        {description && <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>}
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
