// Automatic post-boss Wildwood recovery screen using the Campfire health animation style.
import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { keywordDefinitions, theWildwoods } from "@/features/alchemy/shared/config/game-data-catalog";
import { CAMPFIRE_ANIMATION_MS, CAMPFIRE_CONTINUE_DELAY } from "@/lib/game-constants";
import { getWildwoodRecoveryHealth, WILDWOOD_RECOVERY_FRACTION } from "@/lib/content-systems/wildwood/gauntlet";
import { ScreenDescription, ScreenHeader, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";

interface Props {
  playerHealth: number;
  maxHealth: number;
  onComplete: () => void;
}

export function WildwoodRecoveryScreen({ playerHealth, maxHealth, onComplete }: Props) {
  const targetHealth = getWildwoodRecoveryHealth(playerHealth, maxHealth);
  const [displayHealth, setDisplayHealth] = useState(playerHealth);
  const [progressTarget, setProgressTarget] = useState(playerHealth);
  const frameRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(() => {
      const startTime = performance.now();
      setProgressTarget(targetHealth);
      function animate() {
        const progress = Math.min(1, (performance.now() - startTime) / CAMPFIRE_ANIMATION_MS);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayHealth(Math.round(playerHealth + (targetHealth - playerHealth) * eased));
        if (progress < 1) frameRef.current = requestAnimationFrame(animate);
        else frameRef.current = null;
      }
      frameRef.current = requestAnimationFrame(animate);
    });
    const timeout = setTimeout(() => onCompleteRef.current(), CAMPFIRE_ANIMATION_MS + CAMPFIRE_CONTINUE_DELAY);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      clearTimeout(timeout);
    };
  }, [maxHealth, playerHealth, targetHealth]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-4 py-6 text-center">
      <StaggerGroup className="flex flex-col items-center gap-8">
        <StaggerItem index={0}>
          <ScreenHeader title="Wildwood Recovery" />
        </StaggerItem>
        <StaggerItem index={1}>
          <ScreenDescription>{`Restoring ${Math.round(WILDWOOD_RECOVERY_FRACTION * 100)}% Health`}</ScreenDescription>
        </StaggerItem>
        <StaggerItem index={2}>
          <img
            src={theWildwoods}
            alt="The Wildwoods"
            className="w-full max-w-[37.04cqh] rounded-shell-panel object-contain"
          />
        </StaggerItem>
        <StaggerItem index={3} className="min-w-[clamp(20.56cqh,22cqh,31.11cqh)]">
          <div className="surface-muted rounded-shell-inner px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className={cn("text-sm font-semibold", keywordDefinitions.health.colorClass)}>Health</p>
              <p className="hp-number-pop text-xs font-medium text-muted-foreground">
                {displayHealth} / {maxHealth}
              </p>
            </div>
            <Progress
              value={(progressTarget / maxHealth) * 100}
              fillStyle={{ transitionDuration: `${CAMPFIRE_ANIMATION_MS}ms` }}
              className="campfire-hp-progress mt-2.5 h-2 bg-background/80 [&>div]:bg-destructive"
            />
          </div>
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}
