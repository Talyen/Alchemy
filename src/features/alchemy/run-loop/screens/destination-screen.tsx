// Destination choice screen — pick the next node on the map.
import { useEffect, useMemo } from "react";

import { keywordDefinitions } from "@/lib/game-data";

import { playBattleEvent } from "@/lib/audio";
import { getBossById, getBossEnemy, keywordAliases, SHINE_PALETTES } from "@/features/alchemy/config";
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

  const bossShineColors = useMemo(() => {
    if (!boss) return [];
    const matchedIds = new Set<string>();

    // Boss headers borrow the enemy's combat vocabulary so the warning colors match the fight.
    const traitText = boss.traits.map((t) => t.description).join(" ");
    for (const alias of keywordAliases) {
      if (traitText.includes(alias.match)) {
        matchedIds.add(alias.keywordId);
      }
    }

    for (const effect of boss.attackEffects) {
      if (effect.kind === "damage" && effect.damageType in keywordDefinitions) {
        matchedIds.add(effect.damageType);
      } else if (effect.kind === "player-status" && effect.status in keywordDefinitions) {
        matchedIds.add(effect.status);
      }
    }

    const colors: string[] = [];
    for (const id of matchedIds) {
      const def = keywordDefinitions[id as keyof typeof keywordDefinitions];
      if (def?.shineColors) {
        colors.push(...def.shineColors);
      }
    }
    return colors.length > 0 ? colors : [...SHINE_PALETTES.bossVictoryFallback];
  }, [boss]);
  const bossTextGradient = `linear-gradient(60deg, ${bossShineColors.join(",")})`;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-4 py-6 text-center">
      {bossOnly ? (
        <ScreenHeader
          title={
            <span
              className="boss-title-shine bg-clip-text text-transparent [background-size:300%_300%]"
              style={{ backgroundImage: bossTextGradient }}
            >
              {boss?.title ?? getBossEnemy().title}
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
