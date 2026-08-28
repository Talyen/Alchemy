import { HurtSparkBurst } from "./hurt-spark-burst";
import type { CombatImpactCue } from "../../types";

export function PortraitImpactVfx({
  pulse,
  showHealthFlash,
}: {
  pulse: CombatImpactCue | null;
  showHealthFlash: boolean;
}) {
  if (pulse === null) return null;

  return (
    <>
      {showHealthFlash ? (
        <div
          data-testid="portrait-health-loss-flash"
          className="pointer-events-none absolute inset-0 z-20 animate-hurt-flash rounded-[inherit] bg-red-950/85"
        />
      ) : null}
      <HurtSparkBurst flashToken={pulse.sequence} colors={pulse.colors} />
    </>
  );
}
