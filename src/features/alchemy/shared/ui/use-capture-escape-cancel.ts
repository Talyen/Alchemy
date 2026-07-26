// Escape → cancel via the shared escape stack (MODAL priority).
import { useEffect, useId, useRef } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";

export function useCaptureEscapeCancel(onCancel: (() => void) | undefined) {
  const onCancelRef = useRef(onCancel);
  const escapeId = useId();
  const enabled = onCancel !== undefined;

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!enabled) return;
    return pushEscapeHandler({
      id: `capture-escape-cancel:${escapeId}`,
      priority: ESCAPE_PRIORITY.MODAL,
      onEscape: () => onCancelRef.current?.(),
    });
  }, [enabled, escapeId]);
}
