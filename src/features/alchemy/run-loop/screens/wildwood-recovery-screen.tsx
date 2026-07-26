// Automatic post-boss Wildwood recovery screen using shared heal chrome.
import { useEffect, useRef } from "react";

import { theWildwoods } from "@/features/alchemy/shared/config/game-data-catalog";
import { CAMPFIRE_ANIMATION_MS, CAMPFIRE_CONTINUE_DELAY } from "@/lib/game-constants";
import { getWildwoodRecoveryHealth, WILDWOOD_RECOVERY_FRACTION } from "@/lib/content-systems/wildwood/gauntlet";
import { HealthRestoreMeter } from "../../shared/ui/health-restore-meter";
import { useEasedHealth } from "../../shared/ui/use-eased-health";
import { ScreenDescription, ScreenHeader, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";

interface Props {
  playerHealth: number;
  maxHealth: number;
  onComplete: () => void;
}

export function WildwoodRecoveryScreen({ playerHealth, maxHealth, onComplete }: Props) {
  const targetHealth = getWildwoodRecoveryHealth(playerHealth, maxHealth);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const { displayHealth, progressTarget } = useEasedHealth({
    from: playerHealth,
    to: targetHealth,
    active: true,
  });

  useEffect(() => {
    const timeout = setTimeout(() => onCompleteRef.current(), CAMPFIRE_ANIMATION_MS + CAMPFIRE_CONTINUE_DELAY);
    return () => clearTimeout(timeout);
  }, []);

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
          <HealthRestoreMeter displayHealth={displayHealth} maxHealth={maxHealth} progressTarget={progressTarget} />
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}
