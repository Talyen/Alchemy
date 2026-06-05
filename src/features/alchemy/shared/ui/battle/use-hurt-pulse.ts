// Shared hurt pulse timing for portrait flash, sparks, and overflow-visible on the art frame.
import { useEffect, useRef, useState } from "react";

import { HURT_FLASH_DURATION_MS, HURT_SPARK_DURATION_MS } from "@/lib/game-constants";

const HURT_VFX_DURATION_MS = Math.max(HURT_FLASH_DURATION_MS, HURT_SPARK_DURATION_MS);

export function useHurtPulse(hurtFlashToken: number) {
  const [pulse, setPulse] = useState<number | null>(null);
  const prevTokenRef = useRef(hurtFlashToken);

  useEffect(() => {
    const prev = prevTokenRef.current;
    prevTokenRef.current = hurtFlashToken;
    if (hurtFlashToken <= prev) return;
    setPulse(hurtFlashToken);
    const timer = window.setTimeout(() => setPulse(null), HURT_VFX_DURATION_MS);
    return () => clearTimeout(timer);
  }, [hurtFlashToken]);

  return { pulse, sparksOverflow: pulse !== null };
}
