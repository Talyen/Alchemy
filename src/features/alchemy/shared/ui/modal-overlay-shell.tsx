import { useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { useModalRoot } from "./modal-root";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { cn } from "@/lib/utils";
import { fadePhaseClass, useFadePresence, useHeldWhile } from "./use-fade";
import { useArtworkReady } from "./use-artwork-ready";
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

function ModalContent({
  open,
  className,
  children,
}: {
  open: boolean;
  className: string | undefined;
  children: ReactNode;
}) {
  const [session, setSession] = useState({ open, id: 0 });
  if (session.open !== open) setSession({ open, id: session.id + (open ? 1 : 0) });
  const { ref: artworkRef, pending: artworkPending } = useArtworkReady(session.id);
  const shownChildren = useHeldWhile(open, children);
  const shownClassName = useHeldWhile(open, className);
  // A decode finishing during exit must not reveal a panel that was never shown.
  const pending = useHeldWhile(open, artworkPending);
  const interactive = open && !pending;
  return (
    <div
      key={session.id}
      ref={artworkRef}
      data-modal-content
      data-open={open}
      data-artwork-pending={pending}
      inert={!interactive}
      className={cn("modal-fade absolute inset-0", shownClassName, fadePhaseClass(open ? "enter" : "exit"))}
      onClick={(event) => {
        // Leave only empty panel-layout space eligible for backdrop dismissal.
        if (event.target !== event.currentTarget) event.stopPropagation();
      }}
      onClickCapture={!interactive ? blockInteraction : undefined}
      onKeyDownCapture={!interactive ? blockInactiveKey : undefined}
    >
      {shownChildren}
    </div>
  );
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
  const { mounted } = useFadePresence(open);
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
      className="fixed inset-0"
      onClick={(event) => {
        event.stopPropagation();
        if (dismissOnBackdrop && interactive) onClose();
      }}
      onClickCapture={!interactive ? blockInteraction : undefined}
      onKeyDownCapture={!interactive ? blockInactiveKey : undefined}
    >
      {dim && <div data-open={open} className="modal-fade pointer-events-none absolute inset-0 bg-black/70" />}
      <ModalContent open={open} className={className}>
        {children}
      </ModalContent>
    </div>,
    root ?? document.body,
  );
}
