import { useEffect, useId } from "react";
import { ESCAPE_PRIORITY, pushEscapeHandler } from "@/app/escape-stack";
import { useLatestRef } from "../use-latest-ref";

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
  const onEscapeRef = useLatestRef(onEscape);
  const escapeId = useId();

  useEffect(() => {
    if (!active) return;
    return pushEscapeHandler({
      id: `${id}:${escapeId}`,
      priority,
      onEscape: () => onEscapeRef.current(),
    });
  }, [active, id, escapeId, priority, onEscapeRef]);
}

const noop = () => {};

export function useCaptureEscapeCancel(onCancel: (() => void) | undefined) {
  useModalEscapeDismiss({
    active: onCancel !== undefined,
    id: "capture-escape-cancel",
    onEscape: onCancel ?? noop,
  });
}
