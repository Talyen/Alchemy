import { useState, useEffect } from "react";

import { ScreenDescription, TitledScreenShell } from "../../shared/ui/shared-ui";
import { Button } from "@/components/ui/button";
import { campfire } from "@/features/alchemy/shared/config/game-data-catalog";
import { BUTTON_WIDTH_ACTION } from "@/features/alchemy/shared/config";
import { getCampfireRestHealth } from "@/lib/campfire-heal";
import { CAMPFIRE_CONTINUE_DELAY } from "@/lib/game-constants";
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
  const { displayHealth, progressHealth } = useEasedHealth({
    from: playerHealth,
    to: targetHealth,
    active: resting,
    easing: "linear",
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
    <TitledScreenShell title="Campfire" minHeightClass="min-h-[62cqh]">
      <div className="mt-6 flex flex-col items-center gap-8 text-center">
        <ScreenDescription>{`Rest to Restore ${Math.round(healFraction * 100)}% Health`}</ScreenDescription>
        <div className="flex w-full max-w-[44.45cqh] flex-col items-center gap-8">
          <img src={campfire} alt="Campfire" className="w-full rounded-shell-panel object-contain" loading="eager" />
          <div className="flex min-h-[4.75rem] w-full items-center justify-center">
            {!resting ? (
              <Button size="lg" className={BUTTON_WIDTH_ACTION} onClick={handleRest}>
                Rest
              </Button>
            ) : (
              <HealthRestoreMeter displayHealth={displayHealth} maxHealth={maxHealth} progressHealth={progressHealth} />
            )}
          </div>
        </div>
      </div>
    </TitledScreenShell>
  );
}
