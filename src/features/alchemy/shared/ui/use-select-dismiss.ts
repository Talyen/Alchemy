import { useState } from "react";
import { ESCAPE_PRIORITY } from "@/app/escape-stack";
import { useModalEscapeDismiss } from "./use-modal-escape-dismiss";

// Radix listens below our window capture listener. Register its open state so
// Escape closes a select before it can dismiss the surrounding screen or dialog.
export function useSelectDismiss() {
  const [open, setOpen] = useState(false);
  useModalEscapeDismiss({
    active: open,
    id: "select",
    priority: ESCAPE_PRIORITY.SELECT,
    onEscape: () => setOpen(false),
  });
  return { open, onOpenChange: setOpen };
}
