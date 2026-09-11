import type { KeyboardEvent, ReactNode, SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useModalRoot } from "./modal-root";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { cn } from "@/lib/utils";
import { fadePhaseClass, useFadePresence } from "./use-fade";
import { useModalEscapeDismiss } from "./use-modal-escape-dismiss";

interface ModalOverlayShellProps {
  open: boolean;
  escapeId: string;

  onClose: () => void;
  dismissOnEscape?: boolean;
  dismissOnBackdrop?: boolean;
  escapePriority?: number;
  zIndex?: number;
  dim?: boolean;

  className?: string;
  testId?: string;

  mount?: boolean;
  children: ReactNode;
}

function blockInteraction(event: SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function blockInactiveKey(event: KeyboardEvent) {
  event.stopPropagation();
  if (event.key !== "Tab") event.preventDefault();
}

export function ModalOverlayShell({
  open,
  escapeId,
  onClose,
  dismissOnEscape = true,
  dismissOnBackdrop = false,
  escapePriority = ESCAPE_PRIORITY.MODAL,
  zIndex,
  dim = true,
  className,
  testId,
  mount = true,
  children,
}: ModalOverlayShellProps) {
  const root = useModalRoot();
  const { mounted, phase } = useFadePresence(open);
  const interactive = open && mount && mounted;

  useModalEscapeDismiss({
    active: dismissOnEscape && interactive,
    id: escapeId,
    priority: escapePriority,
    onEscape: onClose,
  });

  if (!mounted || !mount) return null;

  return createPortal(
    <div
      inert={!interactive}
      data-testid={testId}
      style={zIndex !== undefined ? { zIndex } : undefined}
      className={cn("fixed inset-0", dim && "bg-black/70", fadePhaseClass(phase), className)}
      onClick={(event) => {
        event.stopPropagation();
        if (dismissOnBackdrop && interactive && event.target === event.currentTarget) onClose();
      }}
      onClickCapture={!interactive ? blockInteraction : undefined}
      onKeyDownCapture={!interactive ? blockInactiveKey : undefined}
    >
      {children}
    </div>,
    root ?? document.body,
  );
}
