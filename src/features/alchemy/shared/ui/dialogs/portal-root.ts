import { useSyncExternalStore } from "react";

const roots = new Map<string, HTMLElement | null>();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function setPortalRoot(name: string, element: HTMLElement | null) {
  if (roots.get(name) === element) return;
  roots.set(name, element);
  notify();
}

function getPortalRoot(name: string): HTMLElement | null {
  return roots.get(name) ?? null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function usePortalRoot(name: string): HTMLElement | null {
  return useSyncExternalStore(subscribe, () => getPortalRoot(name));
}

export function setModalRoot(element: HTMLElement | null) {
  setPortalRoot("modal", element);
}

export function useModalRoot(): HTMLElement | null {
  return usePortalRoot("modal");
}

export function setTooltipRoot(element: HTMLElement | null) {
  setPortalRoot("tooltip", element);
}

export function useTooltipRoot(): HTMLElement | null {
  return usePortalRoot("tooltip");
}
