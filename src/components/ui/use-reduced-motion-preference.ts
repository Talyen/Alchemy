import { useEffect, useState } from "react";

import { shouldReduceMotion } from "@/lib/animation/animation-prefs";

const listeners = new Set<(reduced: boolean) => void>();
let stopListening: (() => void) | undefined;

function notifyListeners(): void {
  const reduced = shouldReduceMotion();
  for (const listener of listeners) listener(reduced);
}

function subscribe(listener: (reduced: boolean) => void): () => void {
  // Animated text and effects share one browser subscription for the same preference.
  if (listeners.size === 0) {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    media?.addEventListener?.("change", notifyListeners);
    window.addEventListener("storage", notifyListeners);
    stopListening = () => {
      media?.removeEventListener?.("change", notifyListeners);
      window.removeEventListener("storage", notifyListeners);
    };
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopListening?.();
      stopListening = undefined;
    }
  };
}

/**
 * Shared reduced-motion subscription: the localStorage disable flag OR the
 * OS prefers-reduced-motion setting. Lazy-initialized so the first render
 * already matches (no animated flash), then kept in sync via media + storage
 * listeners. Prefer this over Motion's `useReducedMotion` when the
 * `alchemy-disable-animations` flag must also be honored.
 */
export function useReducedMotionPreference(): boolean {
  const [reduced, setReduced] = useState(() => shouldReduceMotion());

  useEffect(() => {
    const unsubscribe = subscribe(setReduced);
    setReduced(shouldReduceMotion());
    return unsubscribe;
  }, []);

  return reduced;
}
