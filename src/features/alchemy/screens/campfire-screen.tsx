// Campfire rest screen — restores a percentage of max HP.
import { useState, useEffect, useRef } from "react";

import { AnimatedHeight } from "../ui/animated-height";
import { ScreenHeader } from "../ui/shared-ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { campfire } from "@/lib/game-data";
import { CAMPFIRE_ANIMATION_MS, CAMPFIRE_CONTINUE_DELAY, CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";

export function CampfireScreen({
  playerHealth,
  maxHp,
  onContinue,
}: {
  playerHealth: number;
  maxHp: number;
  onContinue: () => void;
}) {
  const [resting, setResting] = useState(false);
  const [displayHp, setDisplayHp] = useState(playerHealth);
  const [targetHp, setTargetHp] = useState(playerHealth);
  const [done, setDone] = useState(false);
  const hpCounterRef = useRef<number | null>(null);

  useEffect(() => {
    if (done) {
      const timeout = setTimeout(onContinue, CAMPFIRE_CONTINUE_DELAY);
      return () => clearTimeout(timeout);
    }
  }, [done, onContinue]);

  useEffect(() => {
    return () => {
      if (hpCounterRef.current !== null) cancelAnimationFrame(hpCounterRef.current);
    };
  }, []);

  function handleRest() {
    const startHp = playerHealth;
    const nextTargetHp = Math.min(maxHp, playerHealth + Math.floor(maxHp * CAMPFIRE_HEAL_FRACTION));
    setTargetHp(startHp);
    setResting(true);

    hpCounterRef.current = requestAnimationFrame(() => {
      const startTime = performance.now();
      setTargetHp(nextTargetHp);

      function animateHp() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / CAMPFIRE_ANIMATION_MS);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(startHp + (nextTargetHp - startHp) * easedProgress);
        setDisplayHp(current);
        if (progress < 1) {
          hpCounterRef.current = requestAnimationFrame(animateHp);
        } else {
          hpCounterRef.current = null;
          setTimeout(() => setDone(true), 0);
        }
      }

      hpCounterRef.current = requestAnimationFrame(animateHp);
    });
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-4 py-6 text-center">
      <div>
        <ScreenHeader title="Campfire" />
        <p className="mt-3 text-base text-muted-foreground">Rest to Restore 30% HP</p>
      </div>

      <img src={campfire} alt="Campfire" className="w-full max-w-[400px] rounded-[22px] object-contain" />

      <AnimatedHeight deps={[resting]}>
        {!resting ? (
          <Button size="lg" onClick={handleRest}>
            Rest
          </Button>
        ) : (
          <div className="surface-muted w-[clamp(222px,22vh,336px)] rounded-[24px] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">HP</p>
              <p className="hp-number-pop text-xs font-medium text-muted-foreground">{displayHp} / {maxHp}</p>
            </div>
            <Progress value={(targetHp / maxHp) * 100} className="campfire-hp-progress mt-2.5 h-2 bg-background/80 [&>div]:bg-destructive" />
          </div>
        )}
      </AnimatedHeight>
    </div>
  );
}
