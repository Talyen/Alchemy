// Escape → cancel via the shared escape stack (MODAL priority).
import { useModalEscapeDismiss } from "./use-modal-escape-dismiss";

export function useCaptureEscapeCancel(onCancel: (() => void) | undefined) {
  useModalEscapeDismiss({
    active: onCancel !== undefined,
    id: "capture-escape-cancel",
    onEscape: onCancel ?? (() => {}),
  });
}
