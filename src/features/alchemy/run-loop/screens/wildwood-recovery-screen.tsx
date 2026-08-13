// Automatic post-boss Wildwood recovery screen using shared heal chrome.
import { useEffect } from "react";

import { theWildwoods } from "@/features/alchemy/shared/config/game-data-catalog";
import { CAMPFIRE_ANIMATION_MS, CAMPFIRE_CONTINUE_DELAY } from "@/lib/game-constants";
import { getWildwoodRecoveryHealth, WILDWOOD_RECOVERY_FRACTION } from "@/lib/content-systems/wildwood/gauntlet";
import { HealthRestoreMeter } from "../../shared/ui/health-restore-meter";
import { useLatestRef } from "../../shared/hooks";
import { useEasedHealth } from "../../shared/ui/use-eased-health";
import { ScreenDescription, ScreenHeader } from "../../shared/ui/shared-ui";

interface Props {
  playerHealth: number;
  maxHealth: number;
  onComplete: () => void;
}

export function WildwoodRecoveryScreen({ playerHealth, maxHealth, onComplete }: Props) {
  const targetHealth = getWildwoodRecoveryHealth(playerHealth, maxHealth);
  const onCompleteRef = useLatestRef(onComplete);

  const { displayHealth, progressTarget } = useEasedHealth({
    from: playerHealth,
    to: targetHealth,
    active: true,
  });

  useEffect(() => {
    const timeout = setTimeout(() => onCompleteRef.current(), CAMPFIRE_ANIMATION_MS + CAMPFIRE_CONTINUE_DELAY);
    return () => clearTimeout(timeout);
  }, [onCompleteRef]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-4 py-6 text-center">
      <div className="flex flex-col items-center gap-8">
        <ScreenHeader title="Wildwood Recovery" />
        <ScreenDescription>{`Restoring ${Math.round(WILDWOOD_RECOVERY_FRACTION * 100)}% Health`}</ScreenDescription>
        <img
          src={theWildwoods}
          alt="The Wildwoods"
          className="w-full max-w-[44.45cqh] rounded-shell-panel object-contain"
        />
        <div className="min-w-[clamp(24.67cqh,26.4cqh,37.33cqh)]">
          <HealthRestoreMeter displayHealth={displayHealth} maxHealth={maxHealth} progressTarget={progressTarget} />
        </div>
      </div>
    </div>
  );
}
