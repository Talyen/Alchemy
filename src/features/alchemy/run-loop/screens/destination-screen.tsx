// Destination choice screen — pick the next node on the map.
import { useEffect, useMemo } from "react";

import { playBattleEvent } from "@/lib/audio";
import {
  chooserRowShellWidthClass,
  getBossById,
  getBossEnemy,
  getBossShineGradient,
} from "@/features/alchemy/shared/config";
import { DestinationChoices, TitledScreenShell } from "../../shared/ui/shared-ui";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import type { RewardState } from "@/lib/active-run-session";

export function DestinationScreen({
  rewardState,
  onChoose,
  onPrepare,
  onOpenMenu,
}: {
  rewardState: RewardState;
  onChoose: (destination: Destination) => void;
  onPrepare: () => void;
  onOpenMenu: (rect?: DOMRect) => void;
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

  const title = bossOnly ? (
    <span
      className="boss-title-shine [background-size:300%_300%] bg-clip-text text-transparent"
      style={{ backgroundImage: bossTextGradient }}
    >
      {bossForShine?.title ?? getBossEnemy().title}
    </span>
  ) : (
    "Choose Destination"
  );

  return (
    <TitledScreenShell
      title={title}
      onOpenMenu={onOpenMenu}
      menuLabel="Open destination menu"
      minHeightClass="min-h-[50cqh]"
      maxWidthClass={bossOnly ? "max-w-3xl" : chooserRowShellWidthClass}
    >
      <div className="my-auto flex flex-1 flex-col justify-center py-4">
        <DestinationChoices destinationOptions={destinationOptions} onChoose={onChoose} selectedBoss={boss} />
      </div>
    </TitledScreenShell>
  );
}
