// Campfire rest screen — restores a percentage of max Health.
import { useState, useEffect } from "react";

import { ScreenDescription, ScreenHeader, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
import { Button } from "@/components/ui/button";
import { campfire } from "@/features/alchemy/shared/config/game-data-catalog";
import { BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";
import { CAMPFIRE_CONTINUE_DELAY, getCampfireRestHealth } from "@/lib/game-constants";
import { HealthRestoreMeter } from "../../shared/ui/health-restore-meter";
import { useEasedHealth } from "../../shared/ui/use-eased-health";

export function CampfireScreen({
  playerHealth,
  maxHealth,
  healFraction,
  onContinue,
}: {
  playerHealth: number;
  maxHealth: number;
  healFraction: number;
  onContinue: () => void;
}) {
  const [resting, setResting] = useState(false);
  const [done, setDone] = useState(false);
  const targetHealth = resting ? getCampfireRestHealth(playerHealth, maxHealth, healFraction) : playerHealth;
  const { displayHealth, progressTarget } = useEasedHealth({
    from: playerHealth,
    to: targetHealth,
    active: resting,
    onFinished: () => setDone(true),
  });

  useEffect(() => {
    if (!done) return;
    const timeout = setTimeout(onContinue, CAMPFIRE_CONTINUE_DELAY);
    return () => clearTimeout(timeout);
  }, [done, onContinue]);

  function handleRest() {
    setResting(true);
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-4 py-6 text-center">
      <StaggerGroup className="flex flex-col items-center gap-8">
        <StaggerItem index={0}>
          <ScreenHeader title="Campfire" />
        </StaggerItem>
        <StaggerItem index={1}>
          <ScreenDescription className="text-muted-foreground">
            {`Rest to Restore ${Math.round(healFraction * 100)}% Health`}
          </ScreenDescription>
        </StaggerItem>
        <StaggerItem index={2}>
          <img
            src={campfire}
            alt="Campfire"
            className="w-full max-w-[44.45cqh] rounded-shell-panel object-contain"
            loading="eager"
          />
        </StaggerItem>
        <StaggerItem index={3} className="min-h-16 min-w-[clamp(24.67cqh,26.4cqh,37.33cqh)]">
          {!resting ? (
            <Button size="lg" className={BUTTON_WIDTH_ACTION} onClick={handleRest}>
              Rest
            </Button>
          ) : (
            <HealthRestoreMeter displayHealth={displayHealth} maxHealth={maxHealth} progressTarget={progressTarget} />
          )}
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}
