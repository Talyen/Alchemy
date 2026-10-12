import { useCallback, useEffect, useRef, useState } from "react";

export type HomesteadPurchaseFeedback = (onSeal: () => void) => void;

export interface PurchaseCeremony {
  token: number;
  level: number;
  max: number;
  onSeal: () => void;
}

export function useHomesteadPurchaseCeremony() {
  const [ceremony, setCeremony] = useState<PurchaseCeremony | null>(null);
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const request = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function purchase(action: (feedback: HomesteadPurchaseFeedback) => boolean, level: number, max: number) {
    const previousRequest = request.current;
    const token = ++request.current;
    setPendingLevel(level);
    const success = action((onSeal) => {
      // Save completion can arrive after navigation or a newer purchase.
      if (!mounted.current || request.current !== token) return;
      setPendingLevel(null);
      setCeremony({ token, level, max, onSeal });
    });
    if (!success) {
      request.current = previousRequest;
      setPendingLevel(pendingLevel);
    }
  }

  const finish = useCallback((token: number) => {
    setCeremony((current) => (current?.token === token ? null : current));
  }, []);

  return { ceremony, pendingLevel, purchase, finish };
}
