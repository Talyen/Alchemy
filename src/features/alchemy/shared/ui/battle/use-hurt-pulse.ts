import { useEffect, useRef, useState } from "react";

import type { CombatImpactCue } from "../../types";
import { HURT_FLASH_DURATION_MS, HURT_SPARK_DURATION_MS } from "@/lib/game-constants";

const HURT_VFX_DURATION_MS = Math.max(HURT_FLASH_DURATION_MS, HURT_SPARK_DURATION_MS);

export function useImpactPulse(impactCue: CombatImpactCue | null) {
  const [pulse, setPulse] = useState<CombatImpactCue | null>(null);
  const prevSequenceRef = useRef(impactCue?.sequence ?? 0);

  useEffect(() => {
    if (!impactCue) return;
    if (impactCue.sequence <= prevSequenceRef.current) return;
    prevSequenceRef.current = impactCue.sequence;
    setPulse(impactCue);
    const timer = window.setTimeout(() => setPulse(null), HURT_VFX_DURATION_MS);
    return () => clearTimeout(timer);
  }, [impactCue]);

  const activePulse = impactCue ? pulse : null;
  return { pulse: activePulse, sparksOverflow: activePulse !== null };
}
