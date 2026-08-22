// Fade-aware escape-stack dismissal for modal overlays.
// Registers an escape handler only while the overlay is mounted and not fading
// out, so Escape during the exit animation cannot re-trigger a close.
import { useEffect, useId, useRef } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";

interface ModalEscapeDismissOptions {
  /** True while the overlay is mounted and not in its exit fade. */
  active: boolean;
  id: string;
  priority?: number;
  onEscape: () => void;
}

export function useModalEscapeDismiss({
  active,
  id,
  priority = ESCAPE_PRIORITY.MODAL,
  onEscape,
}: ModalEscapeDismissOptions) {
  const onEscapeRef = useRef(onEscape);
  const escapeId = useId();

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    return pushEscapeHandler({
      id: `${id}:${escapeId}`,
      priority,
      onEscape: () => onEscapeRef.current(),
    });
  }, [active, id, escapeId, priority]);
}
