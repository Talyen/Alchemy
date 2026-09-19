import { useId, type ComponentType, type ReactNode, type RefObject } from "react";
import { AlertTriangle } from "lucide-react";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { Button } from "@/components/ui/button";
import { bodyTextClass } from "@/features/alchemy/shared/config";
import { cn } from "@/lib/utils";
import { useDialogFocus } from "./use-dialog-focus";
import { ModalOverlayShell } from "./modal-overlay-shell";

function ConfirmationDialogPanel({
  children,
  labelledBy,
  describedBy,
  returnFocusRef,
}: {
  children: ReactNode;
  labelledBy: string;
  describedBy: string | undefined;
  returnFocusRef?: RefObject<HTMLElement | null> | undefined;
}) {
  const { panelRef, handleKeyDown } = useDialogFocus(returnFocusRef);
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Modal contains keyboard focus and stops clicks from reaching its backdrop
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      tabIndex={-1}
      data-testid="confirmation-dialog"
      className="alchemy-shell max-h-[90dvh] w-fit max-w-[calc(33.6015*var(--content-rem,1rem))] overflow-y-auto rounded-shell-dialog border border-border/80 px-7 py-7 text-center"
      onKeyDown={handleKeyDown}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

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
        <h2 id={titleId} className={cn("mt-4 font-sans text-2xl font-bold text-balance text-amber-100/75")}>
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
