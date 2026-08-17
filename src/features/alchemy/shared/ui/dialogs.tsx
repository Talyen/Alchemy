// Modal confirmation overlays for destructive or blocking game actions.
// Depends on the shared Button primitive and Lucide icons.
// Used by menus and screens that need explicit player confirmation.
import { useEffect, useId, type ComponentType, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { Button } from "@/components/ui/button";
import { bodyTextClass, sectionTitleClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { fadePhaseClass, useFadePresence } from "./fade-presence";

const DIALOG_CONFIG = {
  dangerTone: "danger",
} as const;

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
  const escapeId = useId();
  const { mounted, phase } = useFadePresence(open);

  useEffect(() => {
    if (!dismissOnEscape || !mounted || phase === "exit") return;
    return pushEscapeHandler({
      id: `confirmation-dialog:${escapeId}`,
      priority: ESCAPE_PRIORITY.DIALOG,
      onEscape: () => onCancel(),
    });
  }, [dismissOnEscape, escapeId, onCancel, mounted, phase]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "motion-overlay fixed inset-0 z-[120] flex items-center justify-center px-6",
        fadePhaseClass(phase),
        dimBackground ? "bg-black/70" : "bg-transparent",
      )}
      onClick={dismissOnBackdrop ? onCancel : undefined}
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
          <Button size="lg" variant={tone === DIALOG_CONFIG.dangerTone ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
