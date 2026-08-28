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

  onEscape: (event: KeyboardEvent) => boolean | void;
}

type EscapeHandlerEntry = EscapeHandler & { seq: number };

const handlers = new Map<string, EscapeHandlerEntry>();
let nextSeq = 0;
let listenerInstalled = false;
let cachedSorted: EscapeHandlerEntry[] = [];

function refreshSortedCache(): void {
  cachedSorted = [...handlers.values()].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.seq - a.seq;
  });
}

function handleWindowKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  for (const handler of cachedSorted) {
    let result: boolean | void;
    try {
      result = handler.onEscape(event);
    } catch (error) {
      console.error("[escape-stack] handler error", handler.id, error);
      continue;
    }
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

export function pushEscapeHandler(handler: EscapeHandler): () => void {
  if (handlers.has(handler.id)) {
    handlers.delete(handler.id);
  }
  const entry: EscapeHandlerEntry = { ...handler, seq: nextSeq++ };
  handlers.set(handler.id, entry);
  refreshSortedCache();
  ensureListener();
  return () => {
    const current = handlers.get(handler.id);
    if (current === entry) {
      handlers.delete(handler.id);
      refreshSortedCache();
      maybeRemoveListener();
    }
  };
}

export function resetEscapeStackForTests(): void {
  handlers.clear();
  cachedSorted = [];
  nextSeq = 0;
  if (listenerInstalled && typeof window !== "undefined") {
    window.removeEventListener("keydown", handleWindowKeyDown, true);
  }
  listenerInstalled = false;
}
