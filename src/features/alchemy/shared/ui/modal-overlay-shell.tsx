// Shared modal backdrop: fade presence, escape-stack dismissal, dim layer, and
// optional backdrop-click dismiss. Consumers render their panel as children and
// keep panel-level styling (including stopPropagation when backdrop click is on).
import type { ReactNode } from "react";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { cn } from "@/lib/utils";
import { fadePhaseClass, useFadePresence } from "./fade-presence";
import { useModalEscapeDismiss } from "./use-modal-escape-dismiss";

interface ModalOverlayShellProps {
  open: boolean;
  escapeId: string;
  /** Escape dismissal target; also the backdrop-click target when dismissOnBackdrop. */
  onClose: () => void;
  dismissOnEscape?: boolean;
  dismissOnBackdrop?: boolean;
  escapePriority?: number;
  position?: "fixed" | "absolute";
  zIndex?: number;
  dim?: boolean;
  /** Extra backdrop classes: centering, padding, named motion classes, pointer-events overrides. */
  className?: string;
  testId?: string;
  /** False unmounts immediately even mid-fade (content-driven gates). */
  mount?: boolean;
  children: ReactNode;
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

  useModalEscapeDismiss({
    active: dismissOnEscape && mounted && phase !== "exit",
    id: escapeId,
    priority: escapePriority,
    onEscape: onClose,
  });

  if (!mounted || !mount) return null;

  return (
    <div
      data-testid={testId}
      style={zIndex !== undefined ? { zIndex } : undefined}
      className={cn(position, "inset-0", dim && "bg-black/70", fadePhaseClass(phase), className)}
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      {children}
    </div>
  );
}
