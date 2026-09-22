import { useState, useEffect } from "react";

import { ScreenDescription, TitledScreenShell } from "../../shared/ui/layout-components";
import { Button } from "@/components/ui/button";
import { campfire } from "@/features/alchemy/shared/config/game-data-catalog";
import { getCampfireRestHealth } from "@/lib/campfire-heal";
import { CAMPFIRE_CONTINUE_DELAY_MS } from "@/lib/game-constants";
import { HealthRestoreMeter } from "../../shared/ui/health-restore-meter";
import { useEasedHealth } from "../../shared/ui/use-eased-health";

export function CampfireScreen({
  playerHealth,
  maxHealth,
  healFraction,
  healingBonus = 0,
  onContinue,
}: {
  playerHealth: number;
  maxHealth: number;
  healFraction: number;
  healingBonus?: number;
  onContinue: () => void;
}) {
  const [rest, setRest] = useState<{ from: number; to: number; maxHealth: number } | null>(null);
  const [done, setDone] = useState(false);
  const resting = rest !== null;
  const restoredHealth = rest
    ? rest.to - rest.from
    : getCampfireRestHealth(playerHealth, maxHealth, healFraction, healingBonus) - playerHealth;
  const { displayHealth, progressHealth } = useEasedHealth({
    from: rest?.from ?? playerHealth,
    to: rest?.to ?? playerHealth,
    active: resting,
    onFinished: () => setDone(true),
  });

  useEffect(() => {
    if (!done) return;
    const timeout = setTimeout(onContinue, CAMPFIRE_CONTINUE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [done, onContinue]);

  function handleRest() {
    setRest({
      from: playerHealth,
      to: getCampfireRestHealth(playerHealth, maxHealth, healFraction, healingBonus),
      maxHealth,
    });
  }

  return (
    <TitledScreenShell title="Campfire" minHeightClass="min-h-[62cqh]">
      <div className="mt-6 flex flex-col items-center gap-8 text-center">
        <ScreenDescription>{`Rest to Restore ${restoredHealth} Health`}</ScreenDescription>
        <div className="flex w-full max-w-[calc(30.0038*var(--content-rem,1rem))] flex-col items-center gap-8">
          <img src={campfire} alt="Campfire" className="w-full rounded-shell-panel object-contain" loading="eager" />
          <div className="flex min-h-[calc(4.75*var(--content-rem,1rem))] w-full items-center justify-center">
            {!resting ? (
              <Button size="lg" className="min-w-56" onClick={handleRest}>
                Rest
              </Button>
            ) : (
              <HealthRestoreMeter
                displayHealth={displayHealth}
                maxHealth={rest.maxHealth}
                progressHealth={progressHealth}
              />
            )}
          </div>
        </div>
      </div>
    </TitledScreenShell>
  );
}
