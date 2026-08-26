// Modal confirmation overlays for destructive or blocking game actions.
// Used by menus and screens that need explicit player confirmation.
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { Button } from "@/components/ui/button";
import { bodyTextClass, sectionTitleClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { ModalOverlayShell } from "./modal-overlay-shell";

export function ConfirmationDialog({
  open = true,
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
  body,
  onConfirm,
  onCancel,
}: {
  open?: boolean;
  title: React.ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  dimBackground?: boolean;
  dismissOnBackdrop?: boolean;
  dismissOnEscape?: boolean;
  icon?: ComponentType<{ className?: string }>;
  body?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalOverlayShell
      open={open}
      escapeId="confirmation-dialog"
      escapePriority={ESCAPE_PRIORITY.DIALOG}
      onClose={onCancel}
      dismissOnEscape={dismissOnEscape}
      dismissOnBackdrop={dismissOnBackdrop}
      position="fixed"
      zIndex={120}
      dim={dimBackground}
      className="motion-overlay flex items-center justify-center px-6"
    >
      <div
        className="motion-panel alchemy-shell w-full max-w-[49.78cqh] rounded-shell-dialog border border-border/80 px-7 py-7 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-200">
          <Icon className="h-6 w-6" />
        </div>
        <h2 className={cn("mt-4 font-sans", sectionTitleClass)}>{title}</h2>
        {description && <p className={cn("mt-3", bodyTextClass)}>{description}</p>}
        {body ? <div className="mt-4">{body}</div> : null}
        <div className="mt-6 flex justify-center gap-3">
          <Button size="lg" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button size="lg" variant={tone === "danger" ? "destructive" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ModalOverlayShell>
  );
}
