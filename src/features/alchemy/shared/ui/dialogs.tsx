import { useId, type ComponentType, type ReactNode, type RefObject } from "react";
import { AlertTriangle } from "lucide-react";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { Button } from "@/components/ui/button";
import { bodyTextClass, sectionTitleClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { ConfirmationDialogPanel } from "./confirmation-dialog-panel";
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

  icon: Icon = AlertTriangle,
  body,
  returnFocusRef,
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
  returnFocusRef?: RefObject<HTMLElement | null> | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <ModalOverlayShell
      open={open}
      escapeId="confirmation-dialog"
      escapePriority={ESCAPE_PRIORITY.DIALOG}
      onClose={onCancel}
      dismissOnEscape={dismissOnEscape}
      dismissOnBackdrop={dismissOnBackdrop}
      zIndex={120}
      dim={dimBackground}
      className="motion-overlay flex items-center justify-center px-6"
    >
      <ConfirmationDialogPanel
        labelledBy={titleId}
        describedBy={description ? descriptionId : undefined}
        returnFocusRef={returnFocusRef}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-200">
          <Icon className="h-6 w-6" />
        </div>
        <h2 id={titleId} className={cn("mt-4 font-sans", sectionTitleClass)}>
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className={cn("mt-3", bodyTextClass)}>
            {description}
          </p>
        )}
        {body ? <div className="mt-4">{body}</div> : null}
        <div className="mt-6 flex justify-center gap-3">
          <Button data-dialog-cancel size="lg" variant="outline" onClick={onCancel} disabled={!open}>
            {cancelLabel}
          </Button>
          <Button
            size="lg"
            variant={tone === "danger" ? "destructive" : "primary"}
            onClick={onConfirm}
            disabled={!open}
          >
            {confirmLabel}
          </Button>
        </div>
      </ConfirmationDialogPanel>
    </ModalOverlayShell>
  );
}
