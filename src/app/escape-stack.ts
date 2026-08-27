// Single-window Escape coordinator: highest-priority handler wins.
// Overlays register here instead of stacking competing capture listeners.
// Handlers may return false to decline so a lower-priority handler (or a
// document-capture consumer such as Radix Select) can handle Escape.

export const ESCAPE_PRIORITY = {
  DIALOG: 100,
  MODAL: 90,
  ARMORY_TRANSIENT: 80,
  SCREEN_OVERLAY: 10,
  APP_MENU: 0,
} as const;

export interface EscapeHandler {
  id: string;
  priority: number;
  /** Return false to decline so a lower-priority handler (or the document) can handle Escape. */
  onEscape: (event: KeyboardEvent) => boolean | void;
}

type EscapeHandlerEntry = EscapeHandler & { seq: number };

const handlers = new Map<string, EscapeHandlerEntry>();
let nextSeq = 0;
let listenerInstalled = false;

function getHandlersHighestFirst(): EscapeHandlerEntry[] {
  return [...handlers.values()].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.seq - a.seq;
  });
}

function handleWindowKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  for (const handler of getHandlersHighestFirst()) {
    const result = handler.onEscape(event);
    if (result === false) continue;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
}

function ensureListener() {
  if (listenerInstalled || typeof window === "undefined") return;
  window.addEventListener("keydown", handleWindowKeyDown, true);
  listenerInstalled = true;
}

function maybeRemoveListener() {
  if (!listenerInstalled || handlers.size > 0 || typeof window === "undefined") return;
  window.removeEventListener("keydown", handleWindowKeyDown, true);
  listenerInstalled = false;
}

/** Register an Escape handler. Returns an unsubscribe that pops this registration. */
export function pushEscapeHandler(handler: EscapeHandler): () => void {
  const entry: EscapeHandlerEntry = { ...handler, seq: nextSeq++ };
  handlers.set(handler.id, entry);
  ensureListener();
  return () => {
    const current = handlers.get(handler.id);
    if (current === entry) {
      handlers.delete(handler.id);
      maybeRemoveListener();
    }
  };
}

/** Test-only: clear all handlers and the shared listener. */
export function resetEscapeStackForTests(): void {
  handlers.clear();
  nextSeq = 0;
  if (listenerInstalled && typeof window !== "undefined") {
    window.removeEventListener("keydown", handleWindowKeyDown, true);
  }
  listenerInstalled = false;
}
