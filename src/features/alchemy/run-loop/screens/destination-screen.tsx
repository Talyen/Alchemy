import { useEffect, useMemo } from "react";

import { playBattleEvent } from "@/lib/audio";
import {
  chooserRowShellWidthClass,
  getBossById,
  getBossEnemy,
  getBossTextShineColors,
} from "@/features/alchemy/shared/config";
import { DestinationChoices } from "../../shared/ui/destination-choices";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { ShineText } from "../../shared/ui/shine-text";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import type { RewardState } from "@/lib/active-run-session";

export function DestinationScreen({
  rewardState,
  onChoose,
  onPrepare,
}: {
  rewardState: RewardState;
  onChoose: (destination: Destination) => void;
  onPrepare?: () => void;
}) {
  const destinationOptions = rewardState.destinations;
  const bossOnly = destinationOptions.length === 1 && destinationOptions[0] === DESTINATIONS.BOSS_COMBAT;

  useEffect(() => {
    onPrepare?.();
  }, [onPrepare]);

  useEffect(() => {
    if (bossOnly) playBattleEvent("deathsDoor");
  }, [bossOnly]);

  const boss = useMemo(
    () => (bossOnly && rewardState.selectedBossId ? (getBossById(rewardState.selectedBossId) ?? null) : null),
    [bossOnly, rewardState.selectedBossId],
  );

  const bossForShine = useMemo(() => boss ?? (bossOnly ? getBossEnemy() : null), [boss, bossOnly]);
  const bossTextShineColors = bossForShine ? getBossTextShineColors(bossForShine) : [];

  const title = bossOnly ? (
    <ShineText colors={bossTextShineColors}>{bossForShine?.title ?? getBossEnemy().title}</ShineText>
  ) : (
    "Choose Destination"
  );

  return (
    <TitledScreenShell title={title} maxWidthClass={bossOnly ? "max-w-3xl" : chooserRowShellWidthClass}>
      <div className="mt-6 flex flex-col justify-center">
        <DestinationChoices destinationOptions={destinationOptions} onChoose={onChoose} selectedBoss={boss} />
      </div>
    </TitledScreenShell>
  );
}
