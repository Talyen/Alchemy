import { useSyncExternalStore } from "react";

let modalRoot: HTMLElement | null = null;
const listeners = new Set<() => void>();

export function setModalRoot(element: HTMLElement | null) {
  modalRoot = element;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return modalRoot;
}

export function useModalRoot() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
