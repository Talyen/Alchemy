import { useEffect, useState } from "react";

import { shouldReduceMotion } from "@/lib/animation/animation-prefs";

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
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(shouldReduceMotion());
    sync();
    media?.addEventListener?.("change", sync);
    window.addEventListener?.("storage", sync);
    return () => {
      media?.removeEventListener?.("change", sync);
      window.removeEventListener?.("storage", sync);
    };
  }, []);

  return reduced;
}
