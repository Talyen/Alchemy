// Brief portrait hurt feedback: red flash overlay + edge spark burst per hit.
// Mounts only for the pulse duration so the overlay never sticks after the animation ends.
import { HurtSparkBurst } from "./hurt-spark-burst";

export function PortraitHurtVfx({ pulse }: { pulse: number | null }) {
  if (pulse === null) return null;

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 animate-hurt-flash rounded-[inherit] bg-red-950/85"
      />
      <HurtSparkBurst flashToken={pulse} />
    </>
  );
}
