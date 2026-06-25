// Campfire rest screen — restores a percentage of max Health.
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

import { ScreenDescription, ScreenHeader, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { campfire, keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { CAMPFIRE_ANIMATION_MS, CAMPFIRE_CONTINUE_DELAY, CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";
export function CampfireScreen({
  playerHealth,
  maxHealth,
  onContinue,
}: {
  playerHealth: number;
  maxHealth: number;
  onContinue: () => void;
}) {
  const [resting, setResting] = useState(false);
  const [displayHealth, setDisplayHealth] = useState(playerHealth);
  const [targetHealth, setTargetHealth] = useState(playerHealth);
  const [done, setDone] = useState(false);
  const healthCounterRef = useRef<number | null>(null);

  useEffect(() => {
    if (done) {
      const timeout = setTimeout(onContinue, CAMPFIRE_CONTINUE_DELAY);
      return () => clearTimeout(timeout);
    }
    return;
  }, [done, onContinue]);

  useEffect(() => {
    return () => {
      if (healthCounterRef.current !== null) cancelAnimationFrame(healthCounterRef.current);
    };
  }, []);

  function handleRest() {
    const startHealth = playerHealth;
    const nextTargetHealth = Math.min(maxHealth, playerHealth + Math.floor(maxHealth * CAMPFIRE_HEAL_FRACTION));
    setTargetHealth(startHealth);
    setResting(true);

    healthCounterRef.current = requestAnimationFrame(() => {
      const startTime = performance.now();
      setTargetHealth(nextTargetHealth);

      function animateHealth() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(1, elapsed / CAMPFIRE_ANIMATION_MS);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(startHealth + (nextTargetHealth - startHealth) * easedProgress);
        setDisplayHealth(current);
        if (progress < 1) {
          healthCounterRef.current = requestAnimationFrame(animateHealth);
        } else {
          healthCounterRef.current = null;
          setTimeout(() => setDone(true), 0);
        }
      }

      healthCounterRef.current = requestAnimationFrame(animateHealth);
    });
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-4 py-6 text-center">
      <StaggerGroup className="flex flex-col items-center gap-8">
        <StaggerItem index={0}>
          <ScreenHeader title="Campfire" />
        </StaggerItem>
        <StaggerItem index={1}>
          <ScreenDescription className="text-muted-foreground">
            {`Rest to Restore ${Math.round(CAMPFIRE_HEAL_FRACTION * 100)}% Health`}
          </ScreenDescription>
        </StaggerItem>
        <StaggerItem index={2}>
          <img
            src={campfire}
            alt="Campfire"
            className="w-full max-w-[37.04cqh] rounded-shell-panel object-contain"
            loading="eager"
          />
        </StaggerItem>
        <StaggerItem index={3} className="min-h-[64px] min-w-[clamp(20.56cqh,22cqh,31.11cqh)]">
          {!resting ? (
            <Button size="lg" onClick={handleRest}>
              Rest
            </Button>
          ) : (
            <div className="surface-muted rounded-shell-inner px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className={cn("text-sm font-semibold", keywordDefinitions.health.colorClass)}>Health</p>
                <p className="hp-number-pop text-xs font-medium text-muted-foreground">
                  {displayHealth} / {maxHealth}
                </p>
              </div>
              <Progress
                value={(targetHealth / maxHealth) * 100}
                fillStyle={{ transitionDuration: `${CAMPFIRE_ANIMATION_MS}ms` }}
                className="campfire-hp-progress mt-2.5 h-2 bg-background/80 [&>div]:bg-destructive"
              />
            </div>
          )}
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}
