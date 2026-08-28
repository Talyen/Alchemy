import type { ReactNode } from "react";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { cn } from "@/lib/utils";
import { fadePhaseClass, useFadePresence } from "./fade-presence";
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
