import { useEffect, useId, useRef } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";

interface ModalEscapeDismissOptions {
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
