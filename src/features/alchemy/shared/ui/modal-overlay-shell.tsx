import type { ReactNode, SyntheticEvent } from "react";
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
  position?: "fixed" | "absolute";
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

export function ModalOverlayShell({
  open,
  escapeId,
  onClose,
  dismissOnEscape = true,
  dismissOnBackdrop = false,
  escapePriority = ESCAPE_PRIORITY.MODAL,
  position = "absolute",
  zIndex,
  dim = true,
  className,
  testId,
  mount = true,
  children,
}: ModalOverlayShellProps) {
  const { mounted, phase } = useFadePresence(open);
  const interactive = open && mount && mounted;

  useModalEscapeDismiss({
    active: dismissOnEscape && interactive,
    id: escapeId,
    priority: escapePriority,
    onEscape: onClose,
  });

  if (!mounted || !mount) return null;

  return (
    <div
      inert={!interactive}
      data-testid={testId}
      style={zIndex !== undefined ? { zIndex } : undefined}
      className={cn(position, "inset-0", dim && "bg-black/70", fadePhaseClass(phase), className)}
      onClick={dismissOnBackdrop && interactive ? onClose : undefined}
      onClickCapture={!interactive ? blockInteraction : undefined}
      onKeyDownCapture={!interactive ? blockInteraction : undefined}
    >
      {children}
    </div>
  );
}
