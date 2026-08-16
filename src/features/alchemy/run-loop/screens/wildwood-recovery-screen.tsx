// Automatic post-boss Wildwood recovery screen using shared heal chrome.
import { useEffect } from "react";

import { wildwoodDraft } from "@/features/alchemy/shared/config/game-data-catalog";
import { CAMPFIRE_ANIMATION_MS, CAMPFIRE_CONTINUE_DELAY } from "@/lib/game-constants";
import { getWildwoodRecoveryHealth, WILDWOOD_RECOVERY_FRACTION } from "@/lib/content-systems/wildwood/gauntlet";
import { HealthRestoreMeter } from "../../shared/ui/health-restore-meter";
import { useLatestRef } from "../../shared/hooks";
import { useEasedHealth } from "../../shared/ui/use-eased-health";
import { ScreenDescription, TitledScreenShell } from "../../shared/ui/shared-ui";

interface Props {
  playerHealth: number;
  maxHealth: number;
  onComplete: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
}

export function WildwoodRecoveryScreen({ playerHealth, maxHealth, onComplete, onOpenMenu }: Props) {
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
    <TitledScreenShell
      title="Wildwood Recovery"
      onOpenMenu={onOpenMenu}
      menuLabel="Open wildwood recovery menu"
      minHeightClass="min-h-[62cqh]"
    >
      <div className="mt-6 flex flex-col items-center gap-8 text-center">
        <ScreenDescription>{`Restoring ${Math.round(WILDWOOD_RECOVERY_FRACTION * 100)}% Health`}</ScreenDescription>
        <div className="flex w-full max-w-[44.45cqh] flex-col items-center gap-8">
          <img src={wildwoodDraft} alt="Wildwood Draft" className="w-full rounded-shell-panel object-contain" />
          <div className="w-full">
            <HealthRestoreMeter displayHealth={displayHealth} maxHealth={maxHealth} progressTarget={progressTarget} />
          </div>
        </div>
      </div>
    </TitledScreenShell>
  );
}
