// Destination choice screen — pick the next node on the map.
import { useEffect, useMemo } from "react";

import { playBattleEvent } from "@/lib/audio";
import { getBossById, getBossEnemy, getBossShineGradient } from "@/features/alchemy/shared/config";
import { DestinationChoices, ScreenHeader } from "../../shared/ui/shared-ui";
import { DESTINATIONS, type Destination } from "../../shared/types";
import type { RewardState } from "../navigation/reward-flow";

export function DestinationScreen({
  rewardState,
  onChoose,
  onPrepare,
}: {
  rewardState: RewardState;
  onChoose: (destination: Destination) => void;
  onPrepare: () => void;
}) {
  const destinationOptions = rewardState.destinations;
  const bossOnly = destinationOptions.length === 1 && destinationOptions[0] === DESTINATIONS.BOSS_COMBAT;

  useEffect(() => {
    onPrepare();
  }, [onPrepare]);

  useEffect(() => {
    if (bossOnly) playBattleEvent("deathsDoor");
  }, [bossOnly]);

  const boss = useMemo(
    () => (bossOnly && rewardState.selectedBossId ? (getBossById(rewardState.selectedBossId) ?? null) : null),
    [bossOnly, rewardState.selectedBossId],
  );

  const bossForShine = useMemo(() => boss ?? (bossOnly ? getBossEnemy() : null), [boss, bossOnly]);
  const bossTextGradient = bossForShine ? getBossShineGradient(bossForShine) : "";

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      {bossOnly ? (
        <ScreenHeader
          title={
            <span
              className="boss-title-shine bg-clip-text text-transparent [background-size:300%_300%]"
              style={{ backgroundImage: bossTextGradient }}
            >
              {bossForShine?.title ?? getBossEnemy().title}
            </span>
          }
        />
      ) : (
        <ScreenHeader title="Choose Destination" />
      )}
      <DestinationChoices destinationOptions={destinationOptions} onChoose={onChoose} selectedBoss={boss} />
    </div>
  );
}
