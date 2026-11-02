import { HurtSparkBurst } from "./hurt-spark-burst";
import type { CombatImpactCue } from "../../../../shared/types";

export interface PortraitImpactVfxProps {
  pulse: CombatImpactCue | null;
  isDead?: boolean;
  showHealthFlash?: boolean;
}

export function PortraitImpactVfx({ pulse, isDead = false, showHealthFlash }: PortraitImpactVfxProps) {
  if (pulse === null) return null;

  const displayFlash = showHealthFlash ?? (!isDead && pulse.healthLost);

  return (
    <>
      {displayFlash ? (
        <div
          key={pulse.sequence}
          data-testid="portrait-health-loss-flash"
          className="pointer-events-none absolute inset-0 z-20 animate-hurt-flash rounded-[inherit] bg-red-950/85"
        />
      ) : null}
      <HurtSparkBurst flashToken={pulse.sequence} colors={pulse.colors} />
    </>
  );
}
